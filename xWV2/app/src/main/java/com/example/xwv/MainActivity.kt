package com.example.xwv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import android.app.DownloadManager
import android.os.Environment
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.RelativeLayout
import android.widget.ImageView
import android.widget.TextView

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    // private lateinit var progressBar: ProgressBar // Removed
    private lateinit var loadingLayout: RelativeLayout
    private lateinit var loadingImage: ImageView
    private lateinit var loadingText: TextView
    
    private var doubleBackToExitPressedOnce = false
    private val handler = Handler(Looper.getMainLooper())
    private var isPrimaryUrlLoaded = false
    
    // Timeout logic
    private val timeoutHandler = Handler(Looper.getMainLooper())
    private var timeoutRunnable: Runnable? = null
    private var pulseAnimator: ObjectAnimator? = null

    // Для загрузки файлов
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    // removed FILE_CHOOSER_REQUEST_CODE

    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private lateinit var photoPickerLauncher: ActivityResultLauncher<Intent>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize the ActivityResultLauncher
        fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (fileChooserCallback != null) {
                val results = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
                fileChooserCallback?.onReceiveValue(results)
                fileChooserCallback = null
            }
        }

        // Photo picker launcher for native gallery access
        photoPickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                val data = result.data
                val photosList = mutableListOf<String>()
                
                try {
                    // Handle multiple photos
                    data?.clipData?.let { clipData ->
                        for (i in 0 until clipData.itemCount) {
                            val uri = clipData.getItemAt(i).uri
                            val base64 = uriToBase64(uri)
                            if (base64 != null) photosList.add(base64)
                        }
                    } ?: run {
                        // Single photo
                        data?.data?.let { uri ->
                            val base64 = uriToBase64(uri)
                            if (base64 != null) photosList.add(base64)
                        }
                    }
                    
                    if (photosList.isNotEmpty()) {
                        val jsonArray = photosList.joinToString("\",\"", "[\"", "\"]")
                        webView.evaluateJavascript("window.onPhotosSelected($jsonArray)", null)
                    }
                } catch (e: Exception) {
                    Log.e("PhotoPicker", "Error processing photos", e)
                    webView.evaluateJavascript("window.onPhotosSelected([])", null)
                }
            } else {
                webView.evaluateJavascript("window.onPhotosSelected([])", null)
            }
        }

        webView = findViewById(R.id.webview)
        loadingLayout = findViewById(R.id.loadingLayout)
        loadingImage = findViewById(R.id.loadingImage)
        loadingText = findViewById(R.id.loadingText)

        setupWebView()

        // Handle back button
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val currentUrl = webView.url ?: ""
                val path = try { Uri.parse(currentUrl).path ?: "" } catch (e: Exception) { "" }
                
                // Define top-level sections where we want the exit dialog instead of history back
                val topLevelPaths = listOf("/movies", "/tvshows", "/gallery", "/books", "/admin", "/")
                val isTopLevel = topLevelPaths.any { path == it || path == "$it/" }

                if (isTopLevel) {
                    // On a main screen - show exit confirmation
                    if (doubleBackToExitPressedOnce) {
                        finish()
                    } else {
                        doubleBackToExitPressedOnce = true
                        Toast.makeText(this@MainActivity, "Нажмите ещё раз для выхода", Toast.LENGTH_SHORT).show()
                        handler.postDelayed({ doubleBackToExitPressedOnce = false }, 2000)
                    }
                } else if (webView.canGoBack()) {
                    // Inside a category (e.g. movie details) - go back to the listing
                    webView.goBack()
                } else {
                    // Fallback for any other case
                    if (doubleBackToExitPressedOnce) {
                        finish()
                    } else {
                        doubleBackToExitPressedOnce = true
                        Toast.makeText(this@MainActivity, "Нажмите ещё раз для выхода", Toast.LENGTH_SHORT).show()
                        handler.postDelayed({ doubleBackToExitPressedOnce = false }, 2000)
                    }
                }
            }
        })

        // Clear cache on start to avoid white screen issues after portal updates
        webView.clearCache(false)

        val primaryUrl = "http://192.168.0.239:5050/"
        val cloudUrl = "https://lightly-shipshape-stonefish.cloudpub.ru/"
        val fallbackUrl = "https://dev.tpw-xxar.ru"

        if (isNetworkAvailable()) {
            loadUrlWithFallback(primaryUrl, cloudUrl, fallbackUrl)
        } else {
            webView.loadUrl(cloudUrl)
            Toast.makeText(this, "Нет подключения к интернету. Загружено облачное приложение.", Toast.LENGTH_LONG).show()
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun loadUrlWithFallback(primaryUrl: String, cloudUrl: String, fallbackUrl: String) {
        isPrimaryUrlLoaded = false
        webView.loadUrl(primaryUrl)
        
        // Store fallback URLs for use in error handler
        webView.tag = mapOf(
            "cloudUrl" to cloudUrl,
            "fallbackUrl" to fallbackUrl
        )
    }

    private fun startLoadingAnimation() {
        if (pulseAnimator == null) {
            pulseAnimator = ObjectAnimator.ofPropertyValuesHolder(
                loadingImage,
                PropertyValuesHolder.ofFloat("scaleX", 1.2f),
                PropertyValuesHolder.ofFloat("scaleY", 1.2f)
            ).apply {
                duration = 600
                repeatCount = ObjectAnimator.INFINITE
                repeatMode = ObjectAnimator.REVERSE
                interpolator = AccelerateDecelerateInterpolator()
            }
        }
        pulseAnimator?.start()
    }

    private fun stopLoadingAnimation() {
        pulseAnimator?.cancel()
        loadingImage.scaleX = 1.0f
        loadingImage.scaleY = 1.0f
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            // databaseEnabled = true // Deprecated
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            setGeolocationEnabled(true)
            builtInZoomControls = true
            displayZoomControls = false
            allowFileAccess = true
            allowContentAccess = true
            userAgentString = userAgentString + " xWV2-App-Identifier"
        }

        webView.addJavascriptInterface(object : Any() {
            @JavascriptInterface
            fun closeApp() {
                runOnUiThread { finish() }
            }
            @JavascriptInterface
            fun shareFile(url: String, title: String) {
                Thread {
                    try {
                        // Скачиваем файл
                        val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                        connection.connect()
                        val inputStream = connection.getInputStream()

                        // Создаём временный файл
                        val fileName = if (title.contains(".")) title else "$title.jpg"
                        val file = java.io.File(cacheDir, fileName)
                        val outputStream = java.io.FileOutputStream(file)

                        // Копируем данные
                        inputStream.copyTo(outputStream)
                        outputStream.close()
                        inputStream.close()

                        // Создаём URI для файла
                        val fileUri = androidx.core.content.FileProvider.getUriForFile(
                            this@MainActivity,
                            "${applicationContext.packageName}.fileprovider",
                            file
                        )

                        runOnUiThread {
                            // Создаём Intent для отправки файла
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "image/*"
                                putExtra(Intent.EXTRA_STREAM, fileUri)
                                putExtra(Intent.EXTRA_SUBJECT, title)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            startActivity(Intent.createChooser(shareIntent, "Поделиться фото"))
                        }
                    } catch (e: Exception) {
                        runOnUiThread {
                            Toast.makeText(this@MainActivity, "Ошибка при загрузке файла: ${e.message}", Toast.LENGTH_LONG).show()
                            Log.e("ShareFile", "Error sharing file", e)
                        }
                    }
                }.start()
            }
            // НОВЫЙ МЕТОД ДЛЯ СКАЧИВАНИЯ:
            @JavascriptInterface
            fun downloadFile(url: String, fileName: String) {
                try {
                    val request = DownloadManager.Request(Uri.parse(url))
                    request.setTitle(fileName)
                    request.setDescription("Загрузка фото из галереи")
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)

                    val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    manager.enqueue(request)

                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "Загрузка началась: $fileName", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "Ошибка при скачивании: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
            
            // НОВЫЙ МЕТОД ДЛЯ НАТИВНОГО ВИДЕОПЛЕЕРА:
            @JavascriptInterface
            fun playVideo(url: String, title: String, itemId: Int, itemType: String, savedPosition: Long) {
                Log.d("MainActivity", "playVideo called: $title (ID: $itemId, Type: $itemType)")
                runOnUiThread {
                    val intent = Intent(this@MainActivity, VideoPlayerActivity::class.java).apply {
                        putExtra("VIDEO_URL", url)
                        putExtra("VIDEO_TITLE", title)
                        putExtra("ITEM_ID", itemId)
                        putExtra("ITEM_TYPE", itemType)
                        putExtra("SAVED_POSITION", savedPosition) // Already in seconds
                    }
                    startActivity(intent)
                }
            }
            
            // НОВЫЙ МЕТОД ДЛЯ ВЫБОРА ФОТО:
            @JavascriptInterface
            fun pickPhotos() {
                runOnUiThread {
                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "image/*"
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                    photoPickerLauncher.launch(Intent.createChooser(intent, "Выберите фото"))
                }
            }
        }, "AndroidApp")

        // === ОБРАБОТКА ВЫБОРА ФАЙЛОВ ===
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback

                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }

                try {
                    fileChooserLauncher.launch(Intent.createChooser(intent, "Выберите фото"))
                } catch (e: Exception) {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = null
                    Toast.makeText(this@MainActivity, "Ошибка запуска выбора файла: ${e.message}", Toast.LENGTH_SHORT).show()
                }

                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                
                // Show custom loading with animation
                loadingLayout.visibility = View.VISIBLE
                startLoadingAnimation()
                
                // Start timeout timer for local server
                if (url?.contains("192.168.0.239") == true) {
                    timeoutRunnable = Runnable {
                        if (!isPrimaryUrlLoaded) {
                            Log.w("WebView", "Timeout reaching local server")
                            stopLoadingAnimation()
                            // Cancel loading and switch to cloud fallback
                            webView.stopLoading()
                            
                            @Suppress("UNCHECKED_CAST")
                            val fallbackUrls = webView.tag as? Map<String, String>
                            val cloudUrl = fallbackUrls?.get("cloudUrl") ?: "https://lightly-shipshape-stonefish.cloudpub.ru/"
                            
                            Toast.makeText(this@MainActivity, "Локальный сервер не отвечает. Переход на облачный сервер...", Toast.LENGTH_SHORT).show()
                            webView.loadUrl(cloudUrl)
                        }
                    }
                    // 2.5 seconds timeout
                    timeoutHandler.postDelayed(timeoutRunnable!!, 2500) 
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                
                // Hide loading and stop animation
                loadingLayout.visibility = View.GONE
                stopLoadingAnimation()
                timeoutRunnable?.let { timeoutHandler.removeCallbacks(it) }
                
                isPrimaryUrlLoaded = true
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                val url = request?.url.toString()
                Log.e("WebViewError", "Error loading $url: ${error?.description}")

                // If primary URL fails to load initially
                if (request?.isForMainFrame == true) {
                    if (!isPrimaryUrlLoaded && url.contains("192.168.0.239")) {
                         timeoutRunnable?.let { timeoutHandler.removeCallbacks(it) }
                         stopLoadingAnimation()
                         runOnUiThread {
                            @Suppress("UNCHECKED_CAST")
                            val fallbackUrls = webView.tag as? Map<String, String>
                            val cloudUrl = fallbackUrls?.get("cloudUrl") ?: "https://lightly-shipshape-stonefish.cloudpub.ru/"
                            
                            Toast.makeText(this@MainActivity, "Ошибка локального сервера. Переход на облачный сервер...", Toast.LENGTH_LONG).show()
                            webView.loadUrl(cloudUrl)
                        }
                    }
                }
                
                // Detection of "White Screen" due to missing scripts (404)
                if (url.contains(".js") || url.contains(".css")) {
                    if (url.contains("192.168.0.239") || url.contains("tpw-xxar.ru")) {
                        Log.w("WebViewError", "Resource failed: $url")
                    }
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (url.startsWith("myapp://exit/") || url.startsWith("myapp://close-reader")) {
                    finish()
                    return true
                }
                return super.shouldOverrideUrlLoading(view, request)
            }
        }
    }

    // removed onActivityResult

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    private fun uriToBase64(uri: Uri): String? {
        return try {
            contentResolver.openInputStream(uri)?.use { inputStream ->
                val bytes = inputStream.readBytes()
                android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
            }
        } catch (e: Exception) {
            Log.e("uriToBase64", "Error converting URI to Base64", e)
            null
        }
    }

    private fun showExitDialog() {
        AlertDialog.Builder(this)
            .setTitle("Выход")
            .setMessage("Вы действительно хотите выйти из приложения?")
            .setPositiveButton("Да") { _, _ -> finish() }
            .setNegativeButton("Нет") { _, _ -> doubleBackToExitPressedOnce = false }
            .show()
    }
}

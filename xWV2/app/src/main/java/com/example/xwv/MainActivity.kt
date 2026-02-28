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
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.http.SslError
import android.widget.ProgressBar
import android.widget.Toast
import android.widget.ImageButton
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
    private lateinit var settingsButton: ImageButton
    private var currentServerUrl: String = "" // Track currently attempted server
    private var enabledServerUrls: List<String> = emptyList()
    private var currentServerIndex: Int = -1
    
    private var doubleBackToExitPressedOnce = false
    private val handler = Handler(Looper.getMainLooper())
    private var isPrimaryUrlLoaded = false
    private var isOfflineAttempt = false
    private var currentVideoUploadFolder = "" // folder for video upload
    
    // Timeout logic
    private val timeoutHandler = Handler(Looper.getMainLooper())
    private var timeoutRunnable: Runnable? = null
    private var pulseAnimator: ObjectAnimator? = null

    // Для загрузки файлов
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    // removed FILE_CHOOSER_REQUEST_CODE

    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private lateinit var photoPickerLauncher: ActivityResultLauncher<Intent>
    private lateinit var videoPickerLauncher: ActivityResultLauncher<Intent>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Restore saved state if any
        if (savedInstanceState != null) {
            currentVideoUploadFolder = savedInstanceState.getString("UPLOAD_FOLDER", "")
        }

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

        // Video picker launcher — uploads directly to backend via HTTP (no WebView reload!)
        videoPickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                val data = result.data
                val uris = mutableListOf<Uri>()

                data?.clipData?.let { clipData ->
                    for (i in 0 until clipData.itemCount) uris.add(clipData.getItemAt(i).uri)
                } ?: data?.data?.let { uri -> uris.add(uri) }

                if (uris.isNotEmpty()) {
                    Thread {
                        uploadVideosToServer(uris, currentVideoUploadFolder)
                    }.start()
                } else {
                    webView.post {
                        webView.evaluateJavascript("window.onVideoUploadComplete && window.onVideoUploadComplete(false, 'No files selected')", null)
                    }
                }
            } else {
                webView.post {
                    webView.evaluateJavascript("window.onVideoUploadComplete && window.onVideoUploadComplete(false, 'Cancelled')", null)
                }
            }
        }

        webView = findViewById(R.id.webview)
        loadingLayout = findViewById(R.id.loadingLayout)
        loadingImage = findViewById(R.id.loadingImage)
        loadingText = findViewById(R.id.loadingText)
        settingsButton = findViewById(R.id.settingsButton)

        settingsButton.setOnClickListener {
            val intent = Intent(this, SettingsActivity::class.java)
            startActivity(intent)
        }

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

        // CLEAR CACHE REMOVED: To allow instant loading from Service Worker and Browser cache
        // webView.clearCache(false)


        // Use saved server URLs
        val enabledServers = getEnabledServerList()
        enabledServerUrls = enabledServers.toList()
        currentServerIndex = 0
        
        Log.i("MainActivity", "=== SERVER STARTUP ===")
        Log.i("MainActivity", "Enabled servers from prefs: $enabledServers")
        Log.i("MainActivity", "Final server list: $enabledServerUrls")
        
        if (enabledServerUrls.isEmpty()) {
            // No servers enabled — show settings
            Log.w("MainActivity", "No servers enabled! Opening settings.")
            loadingLayout.visibility = View.GONE
            Toast.makeText(this, "Нет выбранных серверов. Добавьте сервер в настройках.", Toast.LENGTH_LONG).show()
            val intent = Intent(this, SettingsActivity::class.java)
            startActivity(intent)
            return
        }
        
        val primaryUrl = enabledServerUrls[0]
        Log.i("MainActivity", "Loading primary URL: $primaryUrl")

        if (isNetworkAvailable()) {
            isPrimaryUrlLoaded = false
            currentServerUrl = primaryUrl
            webView.loadUrl(primaryUrl)
        } else {
            // Offline: Force WebView to use cache immediately
            isPrimaryUrlLoaded = false
            isOfflineAttempt = true
            webView.settings.cacheMode = android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK
            Toast.makeText(this, "Нет интернета. Загрузка из кеша...", Toast.LENGTH_SHORT).show()
            webView.loadUrl(primaryUrl)
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
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
            domStorageEnabled = true // CRITICAL for Service Worker
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            setGeolocationEnabled(true)
            builtInZoomControls = true
            displayZoomControls = false
            allowFileAccess = true
            allowContentAccess = true
            userAgentString = userAgentString + " xWV2-App-Identifier"
            Log.d("xWV-Native", "Final User-Agent: $userAgentString")
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
                Log.d("MainActivity", "playVideo URL: $url")
                Log.d("MainActivity", "playVideo serverUrl: $currentServerUrl")
                runOnUiThread {
                    val intent = Intent(this@MainActivity, VideoPlayerActivity::class.java).apply {
                        putExtra("VIDEO_URL", url)
                        putExtra("VIDEO_TITLE", title)
                        putExtra("ITEM_ID", itemId)
                        putExtra("ITEM_TYPE", itemType)
                        putExtra("SAVED_POSITION", savedPosition) // Already in seconds
                        putExtra("SERVER_URL", currentServerUrl) // Pass current server for progress saving
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

            // МЕТОД ДЛЯ ВЫБОРА И ЗАГРУЗКИ ВИДЕО (прямой upload, без перезагрузки страницы!):
            @JavascriptInterface
            fun pickVideos(folder: String) {
                currentVideoUploadFolder = folder
                runOnUiThread {
                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "video/*"
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                    try {
                        videoPickerLauncher.launch(Intent.createChooser(intent, "Выберите видео"))
                    } catch (e: Exception) {
                        Log.e("pickVideos", "Error launching video picker", e)
                    }
                }
            }

            @JavascriptInterface
            fun hideLoadingScreen() {
                runOnUiThread {
                    loadingLayout.visibility = View.GONE
                    stopLoadingAnimation()
                    timeoutRunnable?.let { timeoutHandler.removeCallbacks(it) }
                }
            }

            // NEW METHODS FOR BOOK PROGRESS PERSISTENCE:
            @JavascriptInterface
            fun saveBookProgress(id: Int, progressJson: String) {
                try {
                    val prefs = getSharedPreferences("BookProgress", Context.MODE_PRIVATE)
                    prefs.edit().putString("book_$id", progressJson).apply()
                    Log.d("xWV-Native", "Saved progress for book $id: $progressJson")
                } catch (e: Exception) {
                    Log.e("xWV-Native", "Failed to save book progress", e)
                }
            }

            @JavascriptInterface
            fun getBookProgress(id: Int): String? {
                return try {
                    val prefs = getSharedPreferences("BookProgress", Context.MODE_PRIVATE)
                    val progress = prefs.getString("book_$id", null)
                    Log.d("xWV-Native", "Retrieved progress for book $id: $progress")
                    progress
                } catch (e: Exception) {
                    Log.e("xWV-Native", "Failed to get book progress", e)
                    null
                }
            }

            @JavascriptInterface
            fun openSettings() {
                runOnUiThread {
                    val intent = Intent(this@MainActivity, SettingsActivity::class.java)
                    startActivity(intent)
                }
            }
        }, "AndroidApp")


        // ОБРАБОТКА ВЫБОРА ФАЙЛОВ ===
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback

                // Auto-detect if the page wants videos (accept="video/*")
                val acceptTypes = fileChooserParams?.acceptTypes
                val wantsVideo = acceptTypes?.any { it.contains("video") } == true
                val mimeType = if (wantsVideo) "video/*" else "image/*"
                val chooserTitle = if (wantsVideo) "Выберите видео" else "Выберите фото"

                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }

                try {
                    fileChooserLauncher.launch(Intent.createChooser(intent, chooserTitle))
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
                
                // Stop any existing timeout before starting a new one
                timeoutRunnable?.let { timeoutHandler.removeCallbacks(it) }
                
                // Start timeout timer for local server
                val currentUrl = url ?: ""
                // Check if it's our primary server (could be 192.168... or a custom one)
                // We trust the user's input, so if it's the one we tried to load, we monitor it.
                // However, determining "isPrimary" is tricky if we changed it.
                // Simplification for now: If we are not loaded and timeout passes, ask user.
                
                timeoutRunnable = Runnable {
                    if (!isPrimaryUrlLoaded && url?.startsWith("file://") == false) {
                        Log.w("WebView", "Timeout reached for $url - Skipping to next server")
                        tryNextServer()
                    }
                }
                // Timeout for page load (15 seconds for external servers)
                timeoutHandler.postDelayed(timeoutRunnable!!, 15000) 
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                
                // Hide loading and stop animation
                loadingLayout.visibility = View.GONE
                stopLoadingAnimation()
                timeoutRunnable?.let { timeoutHandler.removeCallbacks(it) }
                
                isPrimaryUrlLoaded = true
                
                // Reset cache mode to default after successful load (especially after offline mode)
                webView.settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
                isOfflineAttempt = false
                
                // If loaded successfully, save this URL as the new default
                url?.let { validUrl ->
                    // Only save if it looks like a base URL (root) or we are just happy it worked.
                    // To avoid saving deep links as the "Server URL", we might want to be careful.
                    // But effectively, if we loaded the "Server URL", we are at root or close to it.
                    // Let's just save validUrl if it matches what we tried to load or user input.
                    // For simplicity, we just save the domain/root if possible, or the full URL.
                    // Actually, let's only save it if we are sure it's the server root we asked for.
                    // But easier: The user entered X. If X loaded, save X.
                    // Since we don't track "what was entered" easily here without extra state,
                    // we can just save it if it's NOT the cloud URL.
                // If loaded successfully, save this URL as the new default if it matches what we tried
                // and it's not the fallback cloud URL.
                if (currentServerUrl.isNotEmpty() && 
                    !currentServerUrl.contains("lightly-shipshape-stonefish.cloudpub.ru") && 
                    !currentServerUrl.contains("dev.tpw-xxar.ru")) {
                     saveServerUrl(currentServerUrl)
                }
            }
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                val url = request?.url.toString()
                Log.e("WebViewError", "Error loading $url: ${error?.description}")

                // If primary URL fails to load initially
                if (request?.isForMainFrame == true) {
                    // Specific handling for Offline Mode attempt
                    if (isOfflineAttempt) {
                        isOfflineAttempt = false
                        // Fallback to instructions if SW cache failed
                        view?.post {
                            view.loadUrl("file:///android_asset/offline.html")
                        }
                        return
                    }

                    if (!isPrimaryUrlLoaded) {
                         timeoutRunnable?.let { timeoutHandler.removeCallbacks(it) }
                         loadingLayout.visibility = View.GONE
                         stopLoadingAnimation()
                         // Store the URL we were trying to load if not already set
                         if (currentServerUrl.isEmpty() && url.isNotEmpty()) {
                             currentServerUrl = url
                         }
                         
                         // If this was an offline attempt and it failed, show catastrophic fallback
                         if (isOfflineAttempt) {
                             isOfflineAttempt = false
                             view?.post {
                                 view.loadUrl("file:///android_asset/offline.html")
                             }
                             return
                         }
                         
                          // Try next server if available
                          tryNextServer()
                    }
                }
                
                // Detection of "White Screen" due to missing scripts (404)
                if (url.contains(".js") || url.contains(".css")) {
                    if (url.contains("192.168.0.239") || url.contains("tpw-xxar.ru")) {
                        Log.w("WebViewError", "Resource failed: $url")
                    }
                }
            }

            // No shouldInterceptRequest override - let Service Worker handle caching!
            // Service Worker from Vite PWA will automatically cache production build

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (url.startsWith("myapp://exit/") || url.startsWith("myapp://close-reader")) {
                    finish()
                    return true
                }
                return super.shouldOverrideUrlLoading(view, request)
            }

            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                Log.w("WebViewSSL", "SSL Error: ${error?.toString()}")
                // For now, allow SSL errors to bypass possible cert issues during dev
                // In production, this should be handled more carefully
                handler?.proceed() 
            }
        }
    }

    // removed onActivityResult

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
        outState.putString("UPLOAD_FOLDER", currentVideoUploadFolder)
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
        
        // Refresh the server list in case the user just changed it in Settings
        val enabledServers = getEnabledServerList()
        val newList = enabledServers.toList()
        
        Log.d("MainActivity", "onResume: enabledServerUrls was: $enabledServerUrls, new: $newList, isPrimaryUrlLoaded=$isPrimaryUrlLoaded")
        
        // If the server list changed AND we haven't loaded successfully yet, restart from index 0
        if (newList != enabledServerUrls) {
            enabledServerUrls = newList
            
            if (!isPrimaryUrlLoaded) {
                // Reset and try from the beginning with the new list
                currentServerIndex = 0
                timeoutRunnable?.let { timeoutHandler.removeCallbacks(it) }
                val primaryUrl = enabledServerUrls[0]
                currentServerUrl = primaryUrl
                Log.i("MainActivity", "Server list changed, reloading from: $primaryUrl")
                webView.loadUrl(primaryUrl)
            }
        }
    }


    private fun saveServerUrl(url: String) {
        val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val serverList = getServerList().toMutableSet()
        serverList.add(url)
        
        prefs.edit()
            .putString("last_server_url", url)
            .putStringSet("server_list", serverList)
            .apply()
    }

    private fun getLastServerUrl(): String {
        val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        return prefs.getString("last_server_url", "http://192.168.0.239:5055") ?: "http://192.168.0.239:5055"
    }
    
    private fun getServerList(): Set<String> {
        val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        return prefs.getStringSet("server_list", emptySet()) ?: emptySet()
    }

    private fun getEnabledServerList(): Set<String> {
        val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        return prefs.getStringSet("enabled_server_list", emptySet()) ?: emptySet()
    }

    private fun tryNextServer() {
        if (isFinishing || isDestroyed) return
        
        runOnUiThread {
            // Cancel current timeout
            timeoutRunnable?.let { timeoutHandler.removeCallbacks(it) }
            
            currentServerIndex++
            if (currentServerIndex < enabledServerUrls.size) {
                val nextUrl = enabledServerUrls[currentServerIndex]
                Log.i("MainActivity", "Trying next server ($currentServerIndex/${enabledServerUrls.size}): $nextUrl")
                currentServerUrl = nextUrl
                webView.loadUrl(nextUrl)
                
                // Restart timeout for the next server (15 seconds for external servers)
                timeoutRunnable?.let { timeoutHandler.postDelayed(it, 15000) }
            } else {
                Log.w("MainActivity", "All servers failed. Triggering offline fallback.")
                triggerOfflineFallback()
            }
        }
    }

    private fun triggerOfflineFallback() {
        if (isFinishing || isDestroyed) return
        
        runOnUiThread {
            loadingLayout.visibility = View.GONE
            stopLoadingAnimation()
            webView.stopLoading()
            
            // If we are ALREADY in an offline attempt and it failed, show the asset fallback
            if (isOfflineAttempt) {
                isOfflineAttempt = false
                webView.loadUrl("file:///android_asset/offline.html")
                return@runOnUiThread
            }

            // Force cache mode for offline attempt
            webView.settings.cacheMode = android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK
            
            val urlToLoad = if (currentServerUrl.isNotEmpty()) currentServerUrl else getLastServerUrl()
            
            // Only trigger reload if not already trying to load something or if it's the same URL
            if (webView.url != urlToLoad || !isOfflineAttempt) {
                isOfflineAttempt = true
                webView.loadUrl(urlToLoad)
                Toast.makeText(this, "Переход в оффлайн режим (кэш)...", Toast.LENGTH_SHORT).show()
            }
        }
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

    private fun uploadVideosToServer(uris: List<Uri>, folder: String) {
        val serverBase = getLastServerUrl().trimEnd('/')
        val uploadUrl = "$serverBase/api/videogallery/upload"
        val total = uris.size

        for ((index, uri) in uris.withIndex()) {
            try {
                val fileName = contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                    val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    cursor.moveToFirst()
                    if (nameIndex >= 0) cursor.getString(nameIndex) else "video_${System.currentTimeMillis()}.mp4"
                } ?: "video_${System.currentTimeMillis()}.mp4"

                val mimeType = contentResolver.getType(uri) ?: "video/mp4"
                val fileSize = contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                    val sizeIndex = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE)
                    cursor.moveToFirst()
                    if (sizeIndex >= 0) cursor.getLong(sizeIndex) else -1L
                } ?: -1L

                // Notify JS upload started
                val escapedName = fileName.replace("'", "\\'")
                webView.post {
                    webView.evaluateJavascript(
                        "window.onVideoUploadProgress && window.onVideoUploadProgress('$escapedName', 0, ${index+1}, $total)", null
                    )
                }

                val boundary = "----AndroidUpload${System.currentTimeMillis()}"
                val connection = java.net.URL(uploadUrl).openConnection() as java.net.HttpURLConnection
                connection.apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
                    setRequestProperty("X-User-Id", getSharedPreferences("AppPrefs", Context.MODE_PRIVATE).getString("device_id", "android-app") ?: "android-app")
                    connectTimeout = 30000
                    readTimeout = 300000 // 5 min for large videos
                    setChunkedStreamingMode(0) // Use chunked mode to avoid ProtocolException with inaccurate fileSize
                }

                val out = java.io.BufferedOutputStream(connection.outputStream)
                val CRLF = "\r\n"
                val dash = "--"

                // Write folder field
                out.write("$dash$boundary$CRLF".toByteArray())
                out.write("Content-Disposition: form-data; name=\"folder\"$CRLF$CRLF".toByteArray())
                out.write(folder.toByteArray())
                out.write(CRLF.toByteArray())

                // Write file field
                out.write("$dash$boundary$CRLF".toByteArray())
                out.write("Content-Disposition: form-data; name=\"file\"; filename=\"$fileName\"$CRLF".toByteArray())
                out.write("Content-Type: $mimeType$CRLF$CRLF".toByteArray())

                contentResolver.openInputStream(uri)?.use { input ->
                    val buffer = ByteArray(65536)
                    var bytesRead: Int
                    var totalRead = 0L
                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        out.write(buffer, 0, bytesRead)
                        totalRead += bytesRead
                        if (fileSize > 0) {
                            val percent = (totalRead * 100 / fileSize).toInt()
                            webView.post {
                                webView.evaluateJavascript(
                                    "window.onVideoUploadProgress && window.onVideoUploadProgress('$escapedName', $percent, ${index+1}, $total)", null
                                )
                            }
                        }
                    }
                }

                out.write("$CRLF$dash$boundary$dash$CRLF".toByteArray())
                out.flush()
                out.close()

                val responseCode = connection.responseCode
                connection.disconnect()

                if (responseCode !in 200..299) {
                    Log.e("VideoUpload", "Server returned $responseCode for $fileName")
                    webView.post {
                        webView.evaluateJavascript(
                            "window.onVideoUploadProgress && window.onVideoUploadProgress('$escapedName', -1, ${index+1}, $total)", null
                        )
                    }
                } else {
                    webView.post {
                        webView.evaluateJavascript(
                            "window.onVideoUploadProgress && window.onVideoUploadProgress('$escapedName', 100, ${index+1}, $total)", null
                        )
                    }
                }

            } catch (e: Exception) {
                Log.e("VideoUpload", "Error uploading video", e)
                val escaped = e.message?.replace("'", "\\'") ?: "Unknown error"
                webView.post {
                    webView.evaluateJavascript(
                        "window.onVideoUploadProgress && window.onVideoUploadProgress('Error', -1, ${index+1}, $total)", null
                    )
                }
            }
        }

        // All done
        webView.post {
            webView.evaluateJavascript(
                "window.onVideoUploadComplete && window.onVideoUploadComplete(true, '')", null
            )
        }
    }
}

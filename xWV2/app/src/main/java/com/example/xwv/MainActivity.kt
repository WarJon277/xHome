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
import android.webkit.WebResourceResponse
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
import android.content.BroadcastReceiver
import android.content.IntentFilter
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    // private lateinit var progressBar: ProgressBar // Removed
    private lateinit var loadingLayout: RelativeLayout
    private lateinit var loadingImage: ImageView
    private lateinit var loadingText: TextView
    private lateinit var settingsButton: ImageButton
    // Install receiver for PackageInstaller API
    private val installReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (intent?.action == "com.example.xwv.INSTALL_COMPLETE") {
                val status = intent.getIntExtra(android.content.pm.PackageInstaller.EXTRA_STATUS, -1)
                when (status) {
                    android.content.pm.PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                        val confirmationIntent = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                            intent.getParcelableExtra(android.content.Intent.EXTRA_INTENT, android.content.Intent::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra<android.content.Intent>(android.content.Intent.EXTRA_INTENT)
                        }
                        if (confirmationIntent != null) {
                            confirmationIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                            try {
                                startActivity(confirmationIntent)
                            } catch (e: Exception) {}
                        }
                    }
                    android.content.pm.PackageInstaller.STATUS_SUCCESS -> {
                        android.widget.Toast.makeText(this@MainActivity, "Установка обновления запущена...", android.widget.Toast.LENGTH_SHORT).show()
                    }
                    else -> {
                        val message = intent.getStringExtra(android.content.pm.PackageInstaller.EXTRA_STATUS_MESSAGE)
                        android.util.Log.e("OTAUpdate", "Install status: $status, message: $message")
                        android.widget.Toast.makeText(this@MainActivity, "Ошибка установки: $message (Status: $status)", android.widget.Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

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

        // Check app version for cache invalidation on update
        val prefs = getSharedPreferences("AppVersion", Context.MODE_PRIVATE)
        val currentVersionCode = packageManager.getPackageInfo(packageName, 0).longVersionCode
        val savedVersionCode = prefs.getLong("last_version_code", -1)
        
        if (savedVersionCode != -1L && savedVersionCode != currentVersionCode) {
            // App was updated - clear old cache
            Log.i("MainActivity", "App updated from $savedVersionCode to $currentVersionCode. Clearing cache...")
            webView.clearCache(true)
            prefs.edit().putLong("last_version_code", currentVersionCode).apply()
            // Also clear Service Worker caches
            webView.evaluateJavascript(
                "if ('caches' in window) { caches.keys().then(names => names.forEach(n => caches.delete(n))); }",
                null
            )
        } else if (savedVersionCode == -1L) {
            // First launch
            prefs.edit().putLong("last_version_code", currentVersionCode).apply()
        }

        // Use saved server URLs
        val enabledServers = getEnabledServerList()
        enabledServerUrls = enabledServers.toList()
        currentServerIndex = 0

        // Register Install Receiver for PackageInstaller API
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(installReceiver, android.content.IntentFilter("com.example.xwv.INSTALL_COMPLETE"), android.content.Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(installReceiver, android.content.IntentFilter("com.example.xwv.INSTALL_COMPLETE"))
        }
        
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

            checkForUpdates(currentServerUrl)
        } else {
            // Offline: Use LOAD_DEFAULT to let Service Worker handle cache
            // Service Worker will serve from manual-pages-v1 or book-pages-cache
            isPrimaryUrlLoaded = false
            isOfflineAttempt = true
            webView.settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            Toast.makeText(this, "Нет интернета. Загрузка из кэша...", Toast.LENGTH_SHORT).show()
            webView.loadUrl(primaryUrl)
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        // VALIDATED ensures actual internet reachability, not just network presence
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
               capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
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
            
            // Enable Service Worker support (required for PWA offline functionality)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                domStorageEnabled = true
            }
            
            // Allow mixed content (HTTP resources on HTTPS page) for local development
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            }

            // Fix User-Agent setting: explicitly get default and append
            val defaultUa = android.webkit.WebSettings.getDefaultUserAgent(this@MainActivity)
            userAgentString = "$defaultUa xWV2-App-Identifier"
            Log.d("xWV-Native", "Final User-Agent: $userAgentString")
        }

        // Add a cookie as an extra layer of identification (WebView sometimes strips custom UA on XHR/fetch)
        val cookieManager = android.webkit.CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setCookie("https://xxar.ru", "app_id=xWV2-App-Identifier; path=/; Max-Age=31536000")

        // Ensure cookie is available to all domains used by the app to prevent 403s on different hosts
        val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val servers = prefs.getStringSet("server_list", setOf("https://xxar.ru")) ?: emptySet()
        for (serverUrl in servers) {
            try {
                cookieManager.setCookie(serverUrl, "app_id=xWV2-App-Identifier; path=/; Max-Age=31536000")
            } catch (e: Exception) {
                Log.e("xWV-Native", "Failed to set cookie for $serverUrl", e)
            }
        }
        cookieManager.flush()

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

            // ===== OFFLINE PAGE NATIVE BACKUP =====
            // Stores cached page HTML in SharedPreferences — never cleared by WebView cache pressure.
            // Used by useManualCache.js to persist offline pages across WebView resets.

            @JavascriptInterface
            fun nativeSavePage(path: String, htmlContent: String) {
                try {
                    val prefs = getSharedPreferences("OfflinePages", Context.MODE_PRIVATE)
                    prefs.edit().putString("page_$path", htmlContent).apply()
                    Log.d("OfflineCache", "Saved page: $path (${htmlContent.length} chars)")
                } catch (e: Exception) {
                    Log.e("OfflineCache", "Failed to save page $path", e)
                }
            }

            @JavascriptInterface
            fun nativeGetPage(path: String): String {
                return try {
                    val prefs = getSharedPreferences("OfflinePages", Context.MODE_PRIVATE)
                    prefs.getString("page_$path", "") ?: ""
                } catch (e: Exception) {
                    Log.e("OfflineCache", "Failed to get page $path", e)
                    ""
                }
            }

            @JavascriptInterface
            fun nativeDeletePage(path: String) {
                try {
                    val prefs = getSharedPreferences("OfflinePages", Context.MODE_PRIVATE)
                    prefs.edit().remove("page_$path").apply()
                    Log.d("OfflineCache", "Deleted page: $path")
                } catch (e: Exception) {
                    Log.e("OfflineCache", "Failed to delete page $path", e)
                }
            }

            @JavascriptInterface
            fun nativeClearPages() {
                try {
                    val prefs = getSharedPreferences("OfflinePages", Context.MODE_PRIVATE)
                    prefs.edit().clear().apply()
                    Log.d("OfflineCache", "Cleared all native offline pages")
                } catch (e: Exception) {
                    Log.e("OfflineCache", "Failed to clear pages", e)
                }
            }

            @JavascriptInterface
            fun nativeGetSavedPaths(): String {
                return try {
                    val prefs = getSharedPreferences("OfflinePages", Context.MODE_PRIVATE)
                    val paths = prefs.all.keys
                        .filter { it.startsWith("page_") }
                        .map { "\"${it.removePrefix("page_")}\"" }
                    "[${paths.joinToString(",")}]"
                } catch (e: Exception) {
                    Log.e("OfflineCache", "Failed to get saved paths", e)
                    "[]"
                }
            }
            // ===== END OFFLINE PAGE NATIVE BACKUP =====

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
                // Timeout for page load (5 seconds)
                timeoutHandler.postDelayed(timeoutRunnable!!, 5000) 
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
                    !currentServerUrl.contains("cloudpub.ru") &&
                    !currentServerUrl.contains("tpw-xxar.ru")) {
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
                        // DON'T immediately fallback to offline.html
                        // Service Worker will try to load from cache automatically
                        // Only show offline.html if SW also fails after timeout
                        view?.postDelayed({
                            // Check if we're still on error page (SW didn't load)
                            if (view?.url == "file:///android_asset/offline.html") {
                                // SW failed, keep offline.html
                                Log.w("OfflineMode", "Service Worker failed to load from cache")
                            }
                        }, 2000)
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

                         // Try next server if available BEFORE showing offline.html
                         if (enabledServerUrls.size > 1) {
                             Log.i("MainActivity", "Trying next server...")
                             tryNextServer()
                         } else {
                             // No more servers - let Service Worker handle cache
                             // Don't show offline.html immediately, give SW time to load
                             Log.w("MainActivity", "No more servers, relying on Service Worker cache")
                         }
                    }
                }
                
                // Detection of "White Screen" due to missing scripts (404)
                if (url.contains(".js") || url.contains(".css")) {
                    if (url.contains("192.168.0.239") || url.contains("tpw-xxar.ru") || url.contains("xxar.ru")) {
                        Log.w("WebViewError", "Resource failed: $url")
                    }
                }
            }

            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                val url = request?.url?.toString() ?: ""
                
                // When offline, attempt to serve SPA HTML from SharedPreferences
                if (request?.isForMainFrame == true && (!isNetworkAvailable() || isOfflineAttempt)) {
                    try {
                        val path = request.url.path ?: "/"
                        val prefs = getSharedPreferences("OfflinePages", Context.MODE_PRIVATE)
                        
                        // Check if we have exact path cached
                        var html = prefs.getString("page_$path", null)
                        
                        // If exact path not found, try the root page (since it's an SPA and index.html is the same)
                        if (html == null) {
                            html = prefs.getString("page_/", null)
                        }
                        
                        // If we found natively backed up HTML, serve it directly
                        if (html != null) {
                            Log.i("OfflineCache", "Serving native backup for $path")
                            val inputStream = java.io.ByteArrayInputStream(html.toByteArray(Charsets.UTF_8))
                            // Create response with no-cache headers to ensure WebView parses it fresh
                            val response = WebResourceResponse("text/html", "utf-8", inputStream)
                            val headers = mutableMapOf(
                                "Cache-Control" to "no-cache, no-store, must-revalidate",
                                "Pragma" to "no-cache",
                                "Expires" to "0"
                            )
                            response.responseHeaders = headers
                            return response
                        }
                    } catch (e: Exception) {
                        Log.e("OfflineCache", "Failed to intercept request", e)
                    }
                }
                
                return super.shouldInterceptRequest(view, request)
            }

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
        return prefs.getString("last_server_url", "https://xxar.ru") ?: "https://xxar.ru"
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(installReceiver)
        } catch (e: Exception) {}
    }

    private fun checkForUpdates(serverUrl: String) {
        if (!isNetworkAvailable()) return
        Thread {
            try {
                val base = serverUrl.trimEnd('/')
                val url = java.net.URL("$base/api/system/updates/latest")
                val connection = url.openConnection() as java.net.HttpURLConnection
                
                // Set User-Agent to pass nginx access check
                connection.setRequestProperty("User-Agent", "xWV2-App-Identifier")
                
                connection.requestMethod = "GET"
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                if (connection.responseCode == 200) {
                    val response = connection.inputStream.bufferedReader().use { it.readText() }
                    val json = org.json.JSONObject(response)
                    if (json.has("version_code")) {
                        val serverVersionCode = json.getInt("version_code")
                        val serverVersionName = json.getString("version_name")
                        val releaseNotes = json.optString("release_notes", "")
                        val isMandatory = json.optBoolean("is_mandatory", false)
                        val apkUrl = json.getString("apk_url")

                        val pInfo = packageManager.getPackageInfo(packageName, 0)
                        val currentVersionCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                            pInfo.longVersionCode.toInt()
                        } else {
                            @Suppress("DEPRECATION")
                            pInfo.versionCode
                        }
                        val currentVersionName = pInfo.versionName ?: "Неизвестно"
                        
                        if (serverVersionCode > currentVersionCode) {
                            runOnUiThread {
                                showUpdateDialog(serverVersionCode, serverVersionName, currentVersionName, releaseNotes, isMandatory, base, apkUrl)
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("OTAUpdate", "Failed to check for updates", e)
            }
        }.start()
    }

    private fun showUpdateDialog(serverVersionCode: Int, serverVersionName: String, currentVersionName: String, releaseNotes: String, isMandatory: Boolean, serverUrl: String, apkUrl: String) {
        val builder = android.app.AlertDialog.Builder(this)
        builder.setTitle("Обновление приложения")
        builder.setMessage("Доступна новая версия для загрузки.\n\n" +
                           "Текущая версия:\t$currentVersionName\n" +
                           "Новая версия:\t\t$serverVersionName\n\n" +
                           "Что нового:\n$releaseNotes")
        builder.setCancelable(!isMandatory)
        
        builder.setPositiveButton("Обновить") { _, _ ->
            startApkDownload(serverUrl, apkUrl, "xwv2_update_$serverVersionCode.apk")
        }
        
        if (!isMandatory) {
            builder.setNegativeButton("Позже") { dialog, _ -> dialog.dismiss() }
        }
        
        builder.show()
    }

    private fun startApkDownload(serverUrl: String, apkUrl: String, fileName: String) {
        val fullUrl = if (apkUrl.startsWith("http")) apkUrl else "$serverUrl$apkUrl"
        android.util.Log.d("OTAUpdate", "Downloading APK from: $fullUrl")
        android.widget.Toast.makeText(this, "Скачивание началось, пожалуйста подождите...", android.widget.Toast.LENGTH_LONG).show()

        Thread {
            try {
                val url = java.net.URL(fullUrl)
                val connection = url.openConnection() as java.net.HttpURLConnection
                
                // Set User-Agent to pass backend access check
                connection.setRequestProperty("User-Agent", "xWV2-App-Identifier")

                // Allow self-signed certs just for OTA if needed
                if (connection is javax.net.ssl.HttpsURLConnection) {
                    val trustAllCerts = arrayOf<javax.net.ssl.TrustManager>(object : javax.net.ssl.X509TrustManager {
                        override fun getAcceptedIssuers(): Array<java.security.cert.X509Certificate> = arrayOf()
                        override fun checkClientTrusted(certs: Array<java.security.cert.X509Certificate>, authType: String) {}
                        override fun checkServerTrusted(certs: Array<java.security.cert.X509Certificate>, authType: String) {}
                    })
                    val sc = javax.net.ssl.SSLContext.getInstance("SSL")
                    sc.init(null, trustAllCerts, java.security.SecureRandom())
                    connection.sslSocketFactory = sc.socketFactory
                    connection.hostnameVerifier = javax.net.ssl.HostnameVerifier { _, _ -> true }
                }

                connection.requestMethod = "GET"
                connection.connect()

                android.util.Log.d("OTAUpdate", "Download response code: ${connection.responseCode}")
                
                if (connection.responseCode != 200) {
                    throw Exception("Ошибка сервера HTTP ${connection.responseCode}")
                }
                
                val dir = getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS) ?: cacheDir
                val file = java.io.File(dir, fileName)
                if (file.exists()) file.delete()
                
                val inputStream = connection.inputStream
                val outputStream = java.io.FileOutputStream(file)
                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                }
                outputStream.close()
                inputStream.close()
                connection.disconnect()
                
                runOnUiThread {
                    android.widget.Toast.makeText(this@MainActivity, "Загрузка завершена! Запуск установки...", android.widget.Toast.LENGTH_LONG).show()
                    installApkFromFile(file)
                }
            } catch (e: Exception) {
                android.util.Log.e("OTAUpdate", "Failed to download update", e)
                runOnUiThread {
                    android.widget.Toast.makeText(this@MainActivity, "Ошибка загрузки: ${e.message}", android.widget.Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun installApkFromFile(file: java.io.File) {
        try {
            val packageInstaller = packageManager.packageInstaller
            val params = android.content.pm.PackageInstaller.SessionParams(
                android.content.pm.PackageInstaller.SessionParams.MODE_FULL_INSTALL
            )
            val sessionId = packageInstaller.createSession(params)
            val session = packageInstaller.openSession(sessionId)

            val out = session.openWrite("package", 0, -1)
            val input = java.io.FileInputStream(file)
            val buffer = ByteArray(65536)
            var length: Int
            while (input.read(buffer).also { length = it } >= 0) {
                out.write(buffer, 0, length)
            }
            session.fsync(out)
            input.close()
            out.close()

            val intent = android.content.Intent("com.example.xwv.INSTALL_COMPLETE")
            intent.setPackage(packageName)
            val pendingIntent = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                android.app.PendingIntent.getBroadcast(
                    this,
                    sessionId,
                    intent,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
                )
            } else {
                android.app.PendingIntent.getBroadcast(
                    this,
                    sessionId,
                    intent,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT
                )
            }

            session.commit(pendingIntent.intentSender)
            session.close()

        } catch (e: Exception) {
            android.util.Log.e("OTAUpdate", "Session Install failed", e)
            android.widget.Toast.makeText(this, "Сбой системной установки: ${e.message}", android.widget.Toast.LENGTH_LONG).show()
        }
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
                
                // Restart timeout for the next server (5 seconds)
                timeoutRunnable?.let { timeoutHandler.postDelayed(it, 5000) }
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

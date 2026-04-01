package com.example.xwv

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.webkit.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import java.net.HttpURLConnection
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager
import java.security.cert.X509Certificate
import kotlin.concurrent.thread

class SettingsActivity : AppCompatActivity() {

    private lateinit var editServerUrl: EditText
    private lateinit var btnAddServer: Button
    private lateinit var serverListContainer: LinearLayout
    private lateinit var btnBack: Button
    private lateinit var prefs: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        editServerUrl = findViewById(R.id.editServerUrl)
        btnAddServer = findViewById(R.id.btnAddServer)
        serverListContainer = findViewById(R.id.serverListContainer)
        btnBack = findViewById(R.id.btnBack)
        val btnClearCache = findViewById<Button>(R.id.btnClearCache)
        val btnCheckUpdates = findViewById<Button>(R.id.btnCheckUpdates)

        btnCheckUpdates.setOnClickListener {
            checkForUpdatesManually()
        }

        btnClearCache.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Очистка кэша")
                .setMessage("Приложение будет полностью очищено от временных файлов и перезагружено. Продолжить?")
                .setPositiveButton("Да") { _, _ ->
                    // 1. Clear WebStorage (IndexedDB, LocalStorage, etc.)
                    WebStorage.getInstance().deleteAllData()
                    
                    // 2. Clear Cookies
                    CookieManager.getInstance().removeAllCookies(null)
                    CookieManager.getInstance().flush()
                    
                    // 3. Clear WebView Cache (requires a dummy instance or handled in MainActivity)
                    val dummyWebView = WebView(this)
                    dummyWebView.clearCache(true)
                    dummyWebView.destroy()

                    Toast.makeText(this, "Кэш очищен. Перезапуск...", Toast.LENGTH_SHORT).show()
                    
                    // 4. Restart the app
                    val intent = packageManager.getLaunchIntentForPackage(packageName)
                    intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(intent)
                    finishAffinity()
                }
                .setNegativeButton("Нет", null)
                .show()
        }

        btnAddServer.setOnClickListener {
            val url = editServerUrl.text.toString().trim()
            if (url.isNotEmpty()) {
                if (url.startsWith("http")) {
                    addServerToList(url, true)
                    saveServers()
                    editServerUrl.text.clear()
                } else {
                    Toast.makeText(this, "URL должен начинаться с http:// или https://", Toast.LENGTH_SHORT).show()
                }
            }
        }

        btnBack.setOnClickListener {
            finish()
        }

        loadServers()
    }

    private fun addServerToList(url: String, enabled: Boolean) {
        val inflater = LayoutInflater.from(this)
        val itemView = inflater.inflate(R.layout.item_server, serverListContainer, false)

        val checkbox = itemView.findViewById<CheckBox>(R.id.serverEnabled)
        val urlText = itemView.findViewById<TextView>(R.id.serverUrlText)
        val statusText = itemView.findViewById<TextView>(R.id.serverStatusText)
        val btnTest = itemView.findViewById<ImageButton>(R.id.btnTestServer)
        val btnEdit = itemView.findViewById<ImageButton>(R.id.btnEditServer)
        val btnDelete = itemView.findViewById<ImageButton>(R.id.btnDeleteServer)

        urlText.text = url
        checkbox.isChecked = enabled

        checkbox.setOnCheckedChangeListener { _, _ -> saveServers() }

        btnEdit.setOnClickListener {
            val editText = EditText(this).apply {
                setText(urlText.text.toString())
                setPadding(50, 20, 50, 20)
            }
            
            AlertDialog.Builder(this)
                .setTitle("Изменить сервер")
                .setView(editText)
                .setPositiveButton("Сохранить") { _, _ ->
                    val newUrl = editText.text.toString().trim()
                    if (newUrl.isNotEmpty() && newUrl.startsWith("http")) {
                        urlText.text = newUrl
                        saveServers()
                    } else {
                        Toast.makeText(this, "URL должен начинаться с http:// или https://", Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Отмена", null)
                .show()
        }

        btnDelete.setOnClickListener {
            serverListContainer.removeView(itemView)
            saveServers()
        }

        btnTest.setOnClickListener {
            statusText.text = "Статус: проверка..."
            statusText.setTextColor(getColor(android.R.color.darker_gray))
            
            thread {
                val success = try {
                    val urlObj = URL(url)
                    val connection = urlObj.openConnection() as HttpURLConnection
                    
                    if (connection is HttpsURLConnection) {
                        val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
                            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
                            override fun checkClientTrusted(certs: Array<X509Certificate>, authType: String) {}
                            override fun checkServerTrusted(certs: Array<X509Certificate>, authType: String) {}
                        })
                        val sc = SSLContext.getInstance("SSL")
                        sc.init(null, trustAllCerts, java.security.SecureRandom())
                        connection.sslSocketFactory = sc.socketFactory
                        connection.hostnameVerifier = javax.net.ssl.HostnameVerifier { _, _ -> true }
                    }

                    connection.connectTimeout = 3000
                    connection.connect()
                    val code = connection.responseCode
                    connection.disconnect()
                    
                    // Consider it "successful ping" if we get 200..399 OR 403 (since our backend uses 403 for unauthorized app access)
                    code in 200..399 || code == HttpURLConnection.HTTP_FORBIDDEN
                } catch (e: Exception) {
                    false
                }

                Handler(Looper.getMainLooper()).post {
                    if (success) {
                        statusText.text = "Статус: доступен"
                        statusText.setTextColor(getColor(android.R.color.holo_green_light))
                    } else {
                        statusText.text = "Статус: не отвечает"
                        statusText.setTextColor(getColor(android.R.color.holo_red_light))
                    }
                }
            }
        }

        serverListContainer.addView(itemView)
    }

    private fun saveServers() {
        val servers = mutableSetOf<String>()
        val enabledServers = mutableSetOf<String>()

        for (i in 0 until serverListContainer.childCount) {
            val view = serverListContainer.getChildAt(i)
            val urlText = view.findViewById<TextView>(R.id.serverUrlText).text.toString()
            val checkbox = view.findViewById<CheckBox>(R.id.serverEnabled)

            servers.add(urlText)
            if (checkbox.isChecked) {
                enabledServers.add(urlText)
            }
        }

        prefs.edit()
            .putStringSet("server_list", servers)
            .putStringSet("enabled_server_list", enabledServers)
            .apply()
    }

    private fun loadServers() {
        val servers = prefs.getStringSet("server_list", setOf("https://xxar.ru")) ?: emptySet()
        val enabledServers = prefs.getStringSet("enabled_server_list", servers) ?: emptySet()

        serverListContainer.removeAllViews()
        for (url in servers) {
            addServerToList(url, enabledServers.contains(url))
        }
    }

    private fun checkForUpdatesManually() {
        val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        
        // Get enabled servers
        val enabledServers = prefs.getStringSet("enabled_server_list", emptySet()) ?: emptySet()
        
        // If no enabled servers, try to get last used server from MainActivity
        val serverUrl = if (enabledServers.isNotEmpty()) {
            enabledServers.first()
        } else {
            val lastServer = prefs.getString("last_server_url", "https://xxar.ru") ?: "https://xxar.ru"
            lastServer
        }

        if (serverUrl.isEmpty()) {
            Toast.makeText(this, "Нет выбранных серверов", Toast.LENGTH_SHORT).show()
            return
        }

        android.util.Log.d("OTAUpdate", "Checking for updates at: $serverUrl")
        Toast.makeText(this, "Проверка обновлений...\nСервер: $serverUrl", Toast.LENGTH_LONG).show()

        Thread {
            try {
                val base = serverUrl.trimEnd('/')
                val url = URL("$base/api/system/updates/latest")
                android.util.Log.d("OTAUpdate", "Request URL: $url")

                // Allow self-signed certificates for local development
                val connection = if (url.protocol == "https") {
                    val trustAllCerts = arrayOf<javax.net.ssl.TrustManager>(object : javax.net.ssl.X509TrustManager {
                        override fun getAcceptedIssuers(): Array<X509Certificate>? = null
                        override fun checkClientTrusted(certs: Array<X509Certificate>?, authType: String?) {}
                        override fun checkServerTrusted(certs: Array<X509Certificate>?, authType: String?) {}
                    })

                    val sslContext = javax.net.ssl.SSLContext.getInstance("TLS")
                    sslContext.init(null, trustAllCerts, java.security.SecureRandom())

                    val httpsConnection = url.openConnection() as javax.net.ssl.HttpsURLConnection
                    httpsConnection.sslSocketFactory = sslContext.socketFactory
                    httpsConnection.hostnameVerifier = javax.net.ssl.HostnameVerifier { _, _ -> true }
                    httpsConnection
                } else {
                    url.openConnection() as java.net.HttpURLConnection
                }

                // Set User-Agent to pass nginx access check
                connection.setRequestProperty("User-Agent", "xWV2-App-Identifier")

                connection.requestMethod = "GET"
                connection.connectTimeout = 5000
                connection.readTimeout = 5000

                val responseCode = connection.responseCode
                Log.d("OTAUpdate", "Response code: $responseCode from $url")
                
                if (responseCode == 200) {
                    val response = connection.inputStream.bufferedReader().use { it.readText() }
                    Log.d("OTAUpdate", "Response: $response")
                    
                    val json = org.json.JSONObject(response)

                    if (json.has("version_code")) {
                        val serverVersionCode = json.getInt("version_code")
                        val serverVersionName = json.getString("version_name")
                        val releaseNotes = json.optString("release_notes", "")
                        val apkUrl = json.getString("apk_url")

                        val pInfo = packageManager.getPackageInfo(packageName, 0)
                        val currentVersionCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                            pInfo.longVersionCode.toInt()
                        } else {
                            @Suppress("DEPRECATION")
                            pInfo.versionCode
                        }
                        val currentVersionName = pInfo.versionName ?: "Неизвестно"

                        Log.d("OTAUpdate", "Server version: $serverVersionCode ($serverVersionName), Current: $currentVersionCode ($currentVersionName)")

                        runOnUiThread {
                            if (serverVersionCode > currentVersionCode) {
                                AlertDialog.Builder(this)
                                    .setTitle("Обновление приложения")
                                    .setMessage("Доступна новая версия.\n\n" +
                                                "Текущая: $currentVersionName\n" +
                                                "Новая: $serverVersionName\n\n" +
                                                "Что нового:\n$releaseNotes")
                                    .setPositiveButton("Обновить") { _, _ ->
                                        val fullUrl = if (apkUrl.startsWith("http")) apkUrl else "$base$apkUrl"
                                        startApkDownload(fullUrl, "xwv2_update_$serverVersionCode.apk")
                                    }
                                    .setNegativeButton("Позже", null)
                                    .show()
                            } else {
                                Toast.makeText(this, "Установлена последняя версия\n$serverVersionName", Toast.LENGTH_LONG).show()
                            }
                        }
                    } else {
                        runOnUiThread {
                            Toast.makeText(this, "Неверный формат ответа сервера", Toast.LENGTH_LONG).show()
                        }
                    }
                } else {
                    val errorBody = try {
                        connection.errorStream?.bufferedReader()?.use { it.readText() } ?: "No error body"
                    } catch (e: Exception) {
                        "Cannot read error body"
                    }
                    Log.e("OTAUpdate", "HTTP error: $responseCode, body: $errorBody")
                    runOnUiThread {
                        Toast.makeText(this, "Ошибка сервера: $responseCode", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                Log.e("OTAUpdate", "Exception: ${e.message}", e)
                runOnUiThread {
                    Toast.makeText(this, "Ошибка: ${e.message}\nСервер: $serverUrl", Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun startApkDownload(url: String, fileName: String) {
        Toast.makeText(this, "Скачивание...", Toast.LENGTH_SHORT).show()
        Log.d("OTAUpdate", "Downloading APK from: $url")
        // Reuse download logic from MainActivity or implement here
        Thread {
            try {
                val fileUrl = URL(url)
                
                // Allow self-signed certificates for local development
                val connection = if (fileUrl.protocol == "https") {
                    val trustAllCerts = arrayOf<javax.net.ssl.TrustManager>(object : javax.net.ssl.X509TrustManager {
                        override fun getAcceptedIssuers(): Array<X509Certificate>? = null
                        override fun checkClientTrusted(certs: Array<X509Certificate>?, authType: String?) {}
                        override fun checkServerTrusted(certs: Array<X509Certificate>?, authType: String?) {}
                    })
                    
                    val sslContext = javax.net.ssl.SSLContext.getInstance("TLS")
                    sslContext.init(null, trustAllCerts, java.security.SecureRandom())
                    
                    val httpsConnection = fileUrl.openConnection() as javax.net.ssl.HttpsURLConnection
                    httpsConnection.sslSocketFactory = sslContext.socketFactory
                    httpsConnection.hostnameVerifier = javax.net.ssl.HostnameVerifier { _, _ -> true }
                    httpsConnection
                } else {
                    fileUrl.openConnection() as HttpURLConnection
                }
                
                connection.setRequestProperty("User-Agent", "xWV2-App-Identifier")
                connection.connect()
                
                val responseCode = connection.responseCode
                Log.d("OTAUpdate", "Download response code: $responseCode")
                
                if (responseCode != 200) {
                    runOnUiThread {
                        Toast.makeText(this, "Ошибка сервера: $responseCode", Toast.LENGTH_LONG).show()
                    }
                    return@Thread
                }
                
                val input = connection.inputStream
                val file = java.io.File(cacheDir, fileName)
                file.outputStream().use { output ->
                    input.copyTo(output)
                }
                Log.d("OTAUpdate", "APK downloaded to: ${file.absolutePath}")

                // Install APK
                val packageInstaller = packageManager.packageInstaller
                val params = android.content.pm.PackageInstaller.SessionParams(
                    android.content.pm.PackageInstaller.SessionParams.MODE_FULL_INSTALL
                )
                val sessionId = packageInstaller.createSession(params)
                val session = packageInstaller.openSession(sessionId)
                file.inputStream().use { input ->
                    session.openWrite(fileName, 0, -1).use { output ->
                        input.copyTo(output)
                        session.fsync(output)
                    }
                }
                session.close()

                Toast.makeText(this, "Загрузка завершена. Установка...", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this, "Ошибка загрузки: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }
}

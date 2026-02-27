package com.example.xwv

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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
        val btnDelete = itemView.findViewById<ImageButton>(R.id.btnDeleteServer)

        urlText.text = url
        checkbox.isChecked = enabled

        checkbox.setOnCheckedChangeListener { _, _ -> saveServers() }

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
        val servers = prefs.getStringSet("server_list", setOf("http://192.168.0.239:5050/")) ?: emptySet()
        val enabledServers = prefs.getStringSet("enabled_server_list", servers) ?: emptySet()

        serverListContainer.removeAllViews()
        for (url in servers) {
            addServerToList(url, enabledServers.contains(url))
        }
    }
}

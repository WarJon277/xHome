package com.example.xwv

import android.content.Context
import android.content.SharedPreferences
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import java.net.HttpURLConnection
import java.net.URL
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
                    val connection = URL(url).openConnection() as HttpURLConnection
                    connection.connectTimeout = 3000
                    connection.connect()
                    val code = connection.responseCode
                    connection.disconnect()
                    code in 200..399
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

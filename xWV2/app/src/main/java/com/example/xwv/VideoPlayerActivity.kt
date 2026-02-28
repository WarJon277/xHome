package com.example.xwv

import android.app.PictureInPictureParams
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.Rational
import android.view.View
import android.view.WindowManager
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import java.net.HttpURLConnection
import java.net.URL

class VideoPlayerActivity : AppCompatActivity() {
    
    private lateinit var player: ExoPlayer
    private lateinit var playerView: PlayerView
    
    private var itemId: Int = 0
    private var itemType: String = ""
    private var videoTitle: String = ""
    private var serverUrl: String = ""
    
    // Timeout for loading
    private val loadingHandler = Handler(Looper.getMainLooper())
    private var loadingTimeoutRunnable: Runnable? = null
    private var hasStartedPlaying = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Fullscreen mode
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        supportActionBar?.hide()
        
        setContentView(R.layout.activity_video_player)
        
        playerView = findViewById(R.id.player_view)
        
        // Get data from Intent
        val videoUrl = intent.getStringExtra("VIDEO_URL") ?: run {
            Log.e("VideoPlayer", "No video URL provided")
            Toast.makeText(this, "Ошибка: URL видео не указан", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        
        videoTitle = intent.getStringExtra("VIDEO_TITLE") ?: "Видео"
        itemId = intent.getIntExtra("ITEM_ID", 0)
        itemType = intent.getStringExtra("ITEM_TYPE") ?: "movie"
        val savedPosition = intent.getLongExtra("SAVED_POSITION", 0L)
        
        // Get server URL dynamically from Intent or SharedPreferences
        serverUrl = intent.getStringExtra("SERVER_URL") ?: run {
            val prefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
            prefs.getString("last_server_url", "http://192.168.0.239:5050") ?: "http://192.168.0.239:5050"
        }
        // Ensure serverUrl doesn't end with /
        serverUrl = serverUrl.trimEnd('/')
        
        Log.d("VideoPlayer", "========== PLAYER START ==========")
        Log.d("VideoPlayer", "Playing: $videoTitle ($itemType #$itemId)")
        Log.d("VideoPlayer", "Video URL: $videoUrl")
        Log.d("VideoPlayer", "Server URL: $serverUrl")
        Log.d("VideoPlayer", "Saved position: $savedPosition seconds")
        
        // Initialize ExoPlayer
        player = ExoPlayer.Builder(this).build()
        playerView.player = player
        
        // Load video
        val mediaItem = MediaItem.fromUri(videoUrl)
        player.setMediaItem(mediaItem)
        player.prepare()
        
        // Restore saved position
        if (savedPosition > 0) {
            player.seekTo(savedPosition * 1000) // Convert seconds to milliseconds
        }
        
        player.playWhenReady = true
        
        // Listen to playback state changes
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                when (playbackState) {
                    Player.STATE_READY -> {
                        hasStartedPlaying = true
                        cancelLoadingTimeout()
                        Log.d("VideoPlayer", "Player ready, duration: ${player.duration / 1000}s")
                    }
                    Player.STATE_ENDED -> {
                        Log.d("VideoPlayer", "Playback ended")
                        saveProgress(player.duration) // Save as completed
                        finish()
                    }
                    Player.STATE_BUFFERING -> {
                        Log.d("VideoPlayer", "Buffering...")
                    }
                    Player.STATE_IDLE -> {
                        Log.d("VideoPlayer", "Player idle")
                    }
                }
            }
            
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (!isPlaying && hasStartedPlaying) {
                    // Save progress when paused
                    saveProgress(player.currentPosition)
                }
            }
            
            override fun onPlayerError(error: PlaybackException) {
                cancelLoadingTimeout()
                Log.e("VideoPlayer", "Player error: ${error.message}", error)
                Log.e("VideoPlayer", "Error code: ${error.errorCode}")
                
                val errorMsg = when (error.errorCode) {
                    PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
                    PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ->
                        "Ошибка сети. Проверьте подключение.\nURL: $videoUrl"
                    PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS ->
                        "Сервер вернул ошибку. Проверьте URL.\nURL: $videoUrl"
                    PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND ->
                        "Файл не найден.\nURL: $videoUrl"
                    PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
                    PlaybackException.ERROR_CODE_DECODING_FAILED ->
                        "Ошибка декодирования видео. Формат не поддерживается."
                    else ->
                        "Ошибка воспроизведения: ${error.message}\nURL: $videoUrl"
                }
                
                runOnUiThread {
                    Toast.makeText(this@VideoPlayerActivity, errorMsg, Toast.LENGTH_LONG).show()
                    // Auto-close after showing error
                    loadingHandler.postDelayed({ finish() }, 3000)
                }
            }
        })
        
        // Start loading timeout (20 seconds)
        startLoadingTimeout()
        
        // Hide system UI for immersive experience
        hideSystemUI()
    }
    
    private fun startLoadingTimeout() {
        loadingTimeoutRunnable = Runnable {
            if (!hasStartedPlaying && !isFinishing && !isDestroyed) {
                Log.w("VideoPlayer", "Loading timeout reached! Video URL: $videoUrl")
                runOnUiThread {
                    Toast.makeText(
                        this,
                        "Видео не загрузилось за 20 секунд.\nПроверьте подключение к серверу.",
                        Toast.LENGTH_LONG
                    ).show()
                    // Don't auto-close, let user decide
                }
            }
        }
        loadingHandler.postDelayed(loadingTimeoutRunnable!!, 20000)
    }
    
    private fun cancelLoadingTimeout() {
        loadingTimeoutRunnable?.let { loadingHandler.removeCallbacks(it) }
    }
    
    // Need to store videoUrl at class level for error messages
    private val videoUrl: String by lazy {
        intent.getStringExtra("VIDEO_URL") ?: ""
    }
    
    private fun saveProgress(positionMs: Long) {
        val positionSeconds = positionMs / 1000
        
        Log.d("VideoPlayer", "Saving progress: $positionSeconds seconds to $serverUrl")
        
        // Save progress to backend API
        Thread {
            try {
                val url = URL("$serverUrl/api/progress")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("X-User-Id", "global")
                connection.doOutput = true
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                
                val json = """
                    {
                        "item_id": $itemId,
                        "item_type": "$itemType",
                        "progress_seconds": $positionSeconds
                    }
                """.trimIndent()
                
                connection.outputStream.use { it.write(json.toByteArray()) }
                
                val responseCode = connection.responseCode
                if (responseCode == 200) {
                    Log.d("VideoPlayer", "Progress saved successfully")
                } else {
                    Log.w("VideoPlayer", "Failed to save progress: HTTP $responseCode")
                }
            } catch (e: Exception) {
                Log.e("VideoPlayer", "Error saving progress", e)
            }
        }.start()
    }
    
    override fun onPause() {
        super.onPause()
        if (::player.isInitialized) {
            player.pause()
            saveProgress(player.currentPosition)
        }
    }
    
    override fun onStop() {
        super.onStop()
        if (::player.isInitialized) {
            saveProgress(player.currentPosition)
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        cancelLoadingTimeout()
        if (::player.isInitialized) {
            player.release()
        }
    }
    
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        
        // Enter Picture-in-Picture mode when user presses Home
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (::player.isInitialized && player.isPlaying) {
                enterPictureInPictureMode(buildPipParams())
            }
        }
    }
    
    private fun buildPipParams(): PictureInPictureParams {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val params = PictureInPictureParams.Builder()
            
            // Set aspect ratio
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                params.setAspectRatio(Rational(16, 9))
            }
            
            params.build()
        } else {
            throw IllegalStateException("PiP not supported")
        }
    }
    
    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: android.content.res.Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        
        if (isInPictureInPictureMode) {
            // Hide player controls in PiP mode
            playerView.hideController()
        } else {
            // Show controls when exiting PiP
            playerView.showController()
        }
    }
    
    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        }
    }
}

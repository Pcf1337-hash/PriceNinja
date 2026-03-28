package com.priceninja.app

import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class ApkInstallerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ApkInstaller"

    @ReactMethod
    fun install(filePath: String, promise: Promise) {
        try {
            val cleanPath = filePath.removePrefix("file://")
            val file = File(cleanPath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "APK not found at: $cleanPath")
                return
            }
            val uri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.provider",
                file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("INSTALL_ERROR", e.message, e)
        }
    }
}

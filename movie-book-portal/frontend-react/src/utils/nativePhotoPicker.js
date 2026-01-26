// Native Photo Picker for Android App
// Bypasses WebView file input to avoid page reload issues

export function isNativeAppAvailable() {
    return typeof window.AndroidApp !== 'undefined' && typeof window.AndroidApp.pickPhotos === 'function';
}

export function pickPhotosNative() {
    return new Promise((resolve, reject) => {
        if (!isNativeAppAvailable()) {
            reject(new Error('Native photo picker not available'));
            return;
        }

        // Set up callback
        window.onPhotosSelected = (base64Array) => {
            try {
                const files = base64Array.map((base64, index) => {
                    // Convert base64 to Blob
                    const byteString = atob(base64);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: 'image/jpeg' });

                    // Convert Blob to File
                    return new File([blob], `photo_${Date.now()}_${index}.jpg`, { type: 'image/jpeg' });
                });

                resolve(files);
            } catch (error) {
                reject(error);
            } finally {
                // Cleanup
                delete window.onPhotosSelected;
            }
        };

        // Call native method
        try {
            window.AndroidApp.pickPhotos();
        } catch (error) {
            delete window.onPhotosSelected;
            reject(error);
        }
    });
}

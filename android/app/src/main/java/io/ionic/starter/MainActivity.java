package io.ionic.starter;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.JavascriptInterface;

public class MainActivity extends BridgeActivity {

    @JavascriptInterface
    public void openAppSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        Uri uri = Uri.fromParts("package", getPackageName(), null);
        intent.setData(uri);
        startActivity(intent);
    }
}

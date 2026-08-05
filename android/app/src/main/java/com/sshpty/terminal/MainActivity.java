package com.sshpty.terminal;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    WebSettings settings = this.bridge.getWebView().getSettings();
                    settings.setForceDark(WebSettings.FORCE_DARK_OFF);
                }
            }
        } catch (Exception e) {
            // Ignore if setting is not available
        }
    }
}

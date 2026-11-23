package com.app.jcmradiorock;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle state) {
        registerPlugin(RadioPlugin.class);
        super.onCreate(state);
    }
}

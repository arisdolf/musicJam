package com.ronik.jamroom;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private void keepAlive() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().onResume();
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        keepAlive();
    }

    @Override
    public void onStop() {
        super.onStop();
        keepAlive();
    }
}
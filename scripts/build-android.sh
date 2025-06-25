#!/bin/bash
# Build and open Android project for Ionic/Capacitor
ionic build && npx cap sync android && npx cap open android

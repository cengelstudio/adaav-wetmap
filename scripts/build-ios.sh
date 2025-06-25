#!/bin/bash
# Build and open iOS project for Ionic/Capacitor
ionic build && npx cap sync ios && npx cap open ios

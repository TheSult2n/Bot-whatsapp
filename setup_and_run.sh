#!/bin/bash

echo "=============================="
echo " تجهيز وتشغيل بوت الاختراق"
echo " للاستخدام المصرح به فقط"
echo "=============================="

# تثبيت المتطلبات
echo "[*] تثبيت المتطلبات..."
sudo apt update
sudo apt install -y nodejs npm chromium-browser adb sshpass smbclient jq

npm install whatsapp-web.js qrcode-terminal

# إنشاء المجلدات
mkdir -p sessions stolen_sessions

# تشغيل البوت
echo "[*] تشغيل البوت..."
node hijack_groups.js
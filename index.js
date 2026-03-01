const { Telegraf } = require('telegraf');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const BOT_TOKEN = '8711805583:AAHrTijLArxZS_xQOHzXSi_Vx6bBSUW8zX4';
const REQUIRED_CHANNEL = '@StoreRealll';
const ADMIN_IDS = ['6816905895'];

// API Face Swap (IkyyOfficial)
const FACE_SWAP_API = 'http://ikyyzyyrestapi.my.id/edit/face-swap';

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════════════════════════
const db = {
  users: new Map(),
  sessions: new Map(),
  stats: new Map()
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS ANIMATION STEPS
// ═══════════════════════════════════════════════════════════════════════════════
const PROCESS_STEPS = [
  { percent: 5, text: '🔍 Mendeteksi wajah pada kedua foto...', icon: '👤', delay: 1200 },
  { percent: 15, text: '📥 Mengunduh data foto dari server...', icon: '⬇️', delay: 1500 },
  { percent: 28, text: '🧠 AI menganalisis fitur wajah sumber...', icon: '🤖', delay: 2000 },
  { percent: 42, text: '🎯 Mapping landmark wajah ke target...', icon: '🗺️', delay: 2200 },
  { percent: 58, text: '✨ Melakukan face swapping process...', icon: '💫', delay: 3000 },
  { percent: 72, text: '🎨 Blending warna & texture matching...', icon: '🖌️', delay: 2500 },
  { percent: 85, text: '🔧 Final rendering & smoothing...', icon: '⚡', delay: 2000 },
  { percent: 95, text: '📤 Mengambil hasil dari server...', icon: '📡', delay: 1500 },
  { percent: 100, text: '✅ Proses face swap selesai!', icon: '🎉', delay: 800 }
];

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function createProgressBar(percent) {
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function formatProgress(stepIndex, totalSteps, percent, text, icon) {
  const bar = createProgressBar(percent);
  return (
    `<blockquote>🎭 FACE SWAP VIP PREMIUM PROCESS</blockquote>\n\n` +
    `${icon} <b>${text}</b>\n\n` +
    `<code>${bar}</code>\n` +
    `<b>${percent}%</b> Completed — Step [${stepIndex}/${totalSteps}]\n\n` +
    `⏱ <i>Estimasi waktu: 10-15 detik</i>\n` +
    `⚠️ <i>Jangan kirim pesan lain sampai selesai!</i>`
  );
}

async function showProgressAnimation(bot, chatId, messageId) {
  const totalSteps = PROCESS_STEPS.length;
  
  for (let i = 0; i < totalSteps; i++) {
    const step = PROCESS_STEPS[i];
    const text = formatProgress(i + 1, totalSteps, step.percent, step.text, step.icon);
    
    try {
      await bot.telegram.editMessageText(chatId, messageId, null, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    } catch (err) {
      console.log('Edit error:', err.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, step.delay));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
const bot = new Telegraf(BOT_TOKEN);

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBERSHIP CHECK
// ═══════════════════════════════════════════════════════════════════════════════
async function checkMembership(ctx, next) {
  const userId = ctx.from.id.toString();
  
  if (ADMIN_IDS.includes(userId)) return next();
  
  const cached = db.users.get(userId);
  const cacheValid = cached && (Date.now() - cached.verifiedAt < 1800000);
  
  if (cacheValid && cached.isMember) return next();
  
  try {
    let isMember = false;
    try {
      const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, userId);
      isMember = ['member', 'administrator', 'creator'].includes(member.status);
    } catch (e) {
      isMember = cached?.isMember || false;
    }
    
    if (!isMember) {
      const channelName = REQUIRED_CHANNEL.replace('@', '');
      return ctx.replyWithHTML(
        `<blockquote>🔒 AKSES TERBATAS — MEMBERSHIP REQUIRED</blockquote>\n\n` +
        `Halo <b>${ctx.from.first_name}</b>! 👋\n\n` +
        `Untuk menggunakan <b>Face Swap VIP Bot</b>, kamu harus bergabung ke channel kami terlebih dahulu.\n\n` +
        `<b>✨ Keuntungan Member VIP:</b>\n` +
        `├ 🎭 Face Swap Unlimited & HD Quality\n` +
        `├ ⚡ Proses Cepat (10-15 detik)\n` +
        `├ 🚫 No Watermark pada Hasil\n` +
        `├ 🔄 Free Update Fitur Terbaru\n` +
        `└ 💎 Prioritas Support 24/7\n\n` +
        `<b>👇 Klik tombol di bawah untuk bergabung:</b>`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔔 Join Channel VIP', url: `https://t.me/${channelName}` }],
              [{ text: '✅ Saya Sudah Join', callback_data: `verify_${userId}` }]
            ]
          }
        }
      );
    }
    
    db.users.set(userId, {
      id: userId,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      isMember: true,
      verifiedAt: Date.now(),
      joinDate: cached?.joinDate || new Date().toISOString()
    });
    
    return next();
  } catch (error) {
    console.error('Membership error:', error);
    return ctx.reply('❌ Terjadi kesalahan sistem. Silakan coba lagi nanti.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// /START COMMAND
// ═══════════════════════════════════════════════════════════════════════════════
bot.command('start', checkMembership, async (ctx) => {
  const user = ctx.from;
  const stats = db.stats.get(user.id.toString()) || { count: 0 };
  
  await ctx.replyWithHTML(
    `<blockquote>🎭 WELCOME TO FACE SWAP VIP BOT</blockquote>\n\n` +
    `Selamat datang, <b>${user.first_name}</b>! ✨\n\n` +
    `<b>🤖 Tentang Bot Ini:</b>\n` +
    `Bot Face Swap Premium dengan AI canggih yang dapat menukar wajah antar foto dengan hasil realistis dan berkualitas tinggi.\n\n` +
    `<b>📸 Cara Menggunakan:</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>Langkah 1:</b> Kirim foto <b>SUMBER</b>\n` +
    `   └ Foto wajah yang ingin dipindahkan\n\n` +
    `<b>Langkah 2:</b> Kirim foto <b>TARGET</b>\n` +
    `   └ Foto yang wajahnya akan diganti\n\n` +
    `<b>Langkah 3:</b> Tunggu proses selesai\n` +
    `   └ Bot akan otomatis memproses dengan animasi\n\n` +
    `<b>✨ Tips Hasil Maksimal:</b>\n` +
    `• Pilih foto dengan wajah terlihat jelas & frontal\n` +
    `• Pastikan pencahayaan cukup terang & merata\n` +
    `• Hindari wajah tertutup (masker/kacamata hitam)\n` +
    `• Gunakan foto berwarna, bukan hitam putih\n` +
    `• Posisi wajah sebaiknya menghadap ke depan\n\n` +
    `<b>📊 Statistik Kamu:</b>\n` +
    `├ Total Face Swap: <b>${stats.count}x</b>\n` +
    `├ Status: <b>🟢 VIP Active</b>\n` +
    `└ Limit: <b>Unlimited</b>\n\n` +
    `<b>🚀 Siap? Kirim foto pertamamu sekarang!</b>\n\n` +
    `<blockquote>💎 Powered by ${REQUIRED_CHANNEL} | API by IkyyOfficial</blockquote>`,
    {
      reply_markup: {
        keyboard: [
          ['📸 Mulai Face Swap', '❓ Panduan Lengkap'],
          ['📊 Status Akun', '📢 Channel VIP']
        ],
        resize_keyboard: true
      }
    }
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHOTO HANDLER — FACE SWAP LOGIC
// ═══════════════════════════════════════════════════════════════════════════════
bot.on('photo', checkMembership, async (ctx) => {
  const userId = ctx.from.id.toString();
  const session = db.sessions.get(userId);
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  
  // STEP 2: Process target photo
  if (session?.step === 'waiting_target') {
    return await processFaceSwap(ctx, session, photo);
  }
  
  // STEP 1: Receive source photo
  await receiveSourcePhoto(ctx, photo);
});

bot.on('document', checkMembership, async (ctx) => {
  const doc = ctx.message.document;
  if (!doc.mime_type?.startsWith('image/')) {
    return ctx.replyWithHTML(
      `<blockquote>❌ FORMAT TIDAK VALID</blockquote>\n\n` +
      `File yang dikirim bukan gambar. Silakan kirim file dengan format JPG, PNG, atau WEBP.`
    );
  }
  
  const userId = ctx.from.id.toString();
  const session = db.sessions.get(userId);
  
  if (session?.step === 'waiting_target') {
    return await processFaceSwap(ctx, session, { file_id: doc.file_id });
  }
  
  await receiveSourcePhoto(ctx, { file_id: doc.file_id, width: '-', height: '-' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1: Receive Source Photo
// ═══════════════════════════════════════════════════════════════════════════════
async function receiveSourcePhoto(ctx, photo) {
  const userId = ctx.from.id.toString();
  const width = photo.width || 'Original';
  const height = photo.height || 'Quality';
  
  db.sessions.set(userId, {
    step: 'waiting_target',
    sourceFileId: photo.file_id,
    timestamp: Date.now()
  });
  
  await ctx.replyWithHTML(
    `<blockquote>✅ FOTO SUMBER BERHASIL DITERIMA</blockquote>\n\n` +
    `<b>📸 Informasi Foto:</b>\n` +
    `├ Tipe: <b>Foto Sumber (Wajah)</b>\n` +
    `├ Resolusi: <b>${width}x${height}</b>\n` +
    `├ Status: <b>🟢 Valid</b>\n\n` +
    `<b>🎯 LANGKAH SELANJUTNYA:</b>\n` +
    `Kirim foto <b>TARGET</b> sekarang!\n\n` +
    `<b>Apa itu foto target?</b>\n` +
    `Foto target adalah foto yang wajahnya akan diganti dengan wajah dari foto sumber yang baru saja kamu kirim.\n\n` +
    `⏳ <i>Menunggu foto kedua...</i>\n\n` +
    `💡 <i>Ketik "batal" kapan saja untuk membatalkan proses</i>\n\n` +
    `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2: Process Face Swap
// ═══════════════════════════════════════════════════════════════════════════════
async function processFaceSwap(ctx, session, targetPhoto) {
  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id;
  
  // Update session
  db.sessions.set(userId, {
    ...session,
    targetFileId: targetPhoto.file_id,
    step: 'processing'
  });
  
  // Send initial processing message
  const progressMsg = await ctx.replyWithHTML(
    `<blockquote>🎭 FACE SWAP VIP PREMIUM PROCESS</blockquote>\n\n` +
    `⏳ <b>Inisialisasi sistem...</b>\n\n` +
    `<code>░░░░░░░░░░░░░░░░░░░░</code>\n` +
    `<b>0%</b> — Step [0/9]\n\n` +
    `⏱ <i>Memulai proses face swap...</i>\n` +
    `⚠️ <i>Jangan kirim pesan lain sampai selesai!</i>`
  );
  
  try {
    // Get file URLs from Telegram
    const sourceFile = await ctx.telegram.getFile(session.sourceFileId);
    const targetFile = await ctx.telegram.getFile(targetPhoto.file_id);
    
    const sourceUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${sourceFile.file_path}`;
    const targetUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${targetFile.file_path}`;
    
    // Show animation
    await showProgressAnimation(bot, chatId, progressMsg.message_id);
    
    // Call API IkyyOfficial
    const apiUrl = `${FACE_SWAP_API}?source=${encodeURIComponent(sourceUrl)}&target=${encodeURIComponent(targetUrl)}`;
    
    const response = await axios.get(apiUrl, {
      timeout: 120000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FaceSwapVIP/2.0'
      }
    });
    
    // Delete progress message
    await ctx.telegram.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
    
    // Validate response
    if (!response.data?.status || !response.data?.result?.image) {
      throw new Error('Invalid API response structure');
    }
    
    const resultImageUrl = response.data.result.image;
    const jobId = response.data.result.job_id || 'N/A';
    
    // Download image from result URL
    const imageResponse = await axios.get(resultImageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    // Send final result
    await ctx.replyWithPhoto(
      { source: Buffer.from(imageResponse.data) },
      {
        caption: (
          `<blockquote>✅ FACE SWAP BERHASIL — PREMIUM QUALITY</blockquote>\n\n` +
          `<b>🎭 Proses Selesai!</b>\n\n` +
          `<b>📊 Detail Proses:</b>\n` +
          `├ Job ID: <code>${jobId}</code>\n` +
          `├ Status: <b>✨ Success</b>\n` +
          `├ Kualitas: <b>HD Premium</b>\n` +
          `├ Processing Time: <b>~12 detik</b>\n` +
          `└ AI Engine: <b>IkyyOfficial API</b>\n\n` +
          `<b>💾 Simpan Foto Ini!</b>\n` +
          `Foto hasil face swap akan hilang jika tidak disimpan. Tekan dan tahan foto untuk menyimpan ke galeri.\n\n` +
          `<b>🚀 Ingin Face Swap Lagi?</b>\n` +
          `Kirim 2 foto baru (sumber & target) untuk memulai proses baru!\n\n` +
          `<blockquote>💎 ${REQUIRED_CHANNEL} | Premium Face Swap Service</blockquote>`
        ),
        parse_mode: 'HTML'
      }
    );
    
    // Update stats
    updateUserStats(ctx.from.id);
    
    // Clear session
    db.sessions.delete(userId);
    
  } catch (error) {
    console.error('Face Swap Error:', error.message);
    
    // Delete progress
    await ctx.telegram.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
    
    // Detailed error message
    let errorDetail = '';
    
    if (error.code === 'ECONNABORTED') {
      errorDetail = `⏱ <b>Timeout Error:</b> Server terlalu lama merespons. Ini biasanya terjadi karena:\n` +
        `• Ukuran foto terlalu besar\n` +
        `• Koneksi internet lambat\n` +
        `• Server sedang sibuk\n\n<b>Solusi:</b> Coba lagi dengan foto berukuran lebih kecil (under 5MB).`;
    } else if (error.response?.status === 400) {
      errorDetail = `🚫 <b>Bad Request:</b> Format atau konten foto tidak valid. Pastikan:\n` +
        `• Kedua foto memiliki wajah yang jelas terlihat\n` +
        `• Wajah tidak terlalu kecil dalam frame\n` +
        `• Format foto adalah JPG atau PNG\n` +
        `• Tidak ada more than 1 face yang terlalu dominan`;
    } else if (error.message.includes('Invalid API response')) {
      errorDetail = `🔧 <b>API Error:</b> Gagal memproses dari server. Coba lagi dalam beberapa saat.`;
    } else {
      errorDetail = `💥 <b>System Error:</b> ${error.message}\n\nSilakan coba lagi atau hubungi admin jika error berlanjut.`;
    }
    
    await ctx.replyWithHTML(
      `<blockquote>❌ FACE SWAP GAGAL</blockquote>\n\n` +
      `Maaf, terjadi kesalahan saat memproses face swap.\n\n` +
      `${errorDetail}\n\n` +
      `<b>🔄 Coba lagi dengan:</b>\n` +
      `• Foto berbeda dengan kualitas lebih baik\n` +
      `• Pastikan wajah terlihat jelas di kedua foto\n` +
      `• Ukuran file tidak lebih dari 5MB\n\n` +
      `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`
    );
    
    db.sessions.delete(userId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════
bot.hears('📸 Mulai Face Swap', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>🎭 MULAI FACE SWAP</blockquote>\n\n` +
    `<b>Kirim foto SUMBER sekarang!</b> 👤\n\n` +
    `Foto sumber adalah foto wajah yang ingin kamu pindahkan ke foto lain.\n\n` +
    `<b>Contoh:</b> Foto selfie kamu, foto artis favorit, dll.`
  );
});

bot.hears('❓ Panduan Lengkap', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>📖 PANDUAN LENGKAP FACE SWAP VIP</blockquote>\n\n` +
    `<b>🎯 Tutorial Step by Step:</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `<b>STEP 1 — Kirim Foto Sumber:</b>\n` +
    `• Kirim foto dengan wajah yang ingin dipindahkan\n` +
    `• Tunggu konfirmasi "Foto sumber diterima"\n` +
    `• Pastikan wajah terlihat jelas & tidak blur\n\n` +
    `<b>STEP 2 — Kirim Foto Target:</b>\n` +
    `• Kirim foto kedua yang wajahnya akan diganti\n` +
    `• Bot akan otomatis memulai proses\n` +
    `• Tunggu animasi progress 0% sampai 100%\n\n` +
    `<b>STEP 3 — Dapatkan Hasil:</b>\n` +
    `• Foto hasil akan dikirim otomatis\n` +
    `• Simpan segera (foto tidak tersimpan di server)\n` +
    `• Kirim 2 foto baru untuk face swap lagi\n\n` +
    `<b>⚠️ DO's and DON'Ts:</b>\n` +
    `✅ DO: Foto wajah frontal, terang, jelas\n` +
    `✅ DO: Format JPG/PNG dengan ukuran < 5MB\n` +
    `❌ DON'T: Wajah terlalu kecil di foto\n` +
    `❌ DON'T: Foto gelap, blur, atau terlalu banyak wajah\n` +
    `❌ DON'T: Mengirim pesan saat proses berjalan\n\n` +
    `<b>💡 Pro Tips:</b>\n` +
    `• Gunakan foto dengan ekspresi netral untuk hasil terbaik\n` +
    `• Pencahayaan yang sama pada kedua foto = hasil lebih bagus\n` +
    `• Wajah dengan sudut serupa (depan/depan atau samping/samping)\n\n` +
    `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`
  );
});

bot.hears('📊 Status Akun', checkMembership, (ctx) => {
  const userId = ctx.from.id.toString();
  const user = db.users.get(userId);
  const stats = db.stats.get(userId) || { count: 0, lastUsed: null };
  
  const lastUsed = stats.lastUsed 
    ? new Date(stats.lastUsed).toLocaleString('id-ID', { 
        day: 'numeric', month: 'long', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      })
    : 'Belum pernah digunakan';
  
  ctx.replyWithHTML(
    `<blockquote>📊 STATUS AKUN VIP</blockquote>\n\n` +
    `<b>👤 Informasi Pengguna:</b>\n` +
    `├ Nama: <b>${ctx.from.first_name}</b>\n` +
    `├ User ID: <code>${ctx.from.id}</code>\n` +
    `├ Username: ${ctx.from.username ? '@' + ctx.from.username : '—'}\n` +
    `├ Member Sejak: <b>${user ? new Date(user.joinDate).toLocaleDateString('id-ID') : '-'}</b>\n` +
    `└ Status: <b>🟢 VIP Active</b>\n\n` +
    `<b>📈 Statistik Penggunaan:</b>\n` +
    `├ Total Face Swap: <b>${stats.count}x</b>\n` +
    `├ Terakhir Digunakan: <b>${lastUsed}</b>\n` +
    `├ Limit Harian: <b>Unlimited ♾️</b>\n` +
    `└ Kualitas: <b>HD Premium</b>\n\n` +
    `<b>🎭 Siap untuk face swap selanjutnya!</b>\n\n` +
    `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`
  );
});

bot.hears('📢 Channel VIP', (ctx) => {
  const channelName = REQUIRED_CHANNEL.replace('@', '');
  ctx.replyWithHTML(
    `<blockquote>📢 CHANNEL VIP COMMUNITY</blockquote>\n\n` +
    `Bergabunglah dengan channel kami untuk:\n` +
    `• 📢 Update fitur terbaru\n` +
    `• 🎁 Giveaway & event spesial\n` +
    `• 💬 Komunitas pengguna bot\n` +
    `• 🆘 Bantuan & support\n\n` +
    `<b>👇 Klik tombol di bawah untuk join:</b>`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔔 Join Channel VIP', url: `https://t.me/${channelName}` }]
        ]
      }
    }
  );
});

// Cancel handler
bot.hears(['batal', 'Batal', '❌ Batal', 'cancel', 'Cancel'], checkMembership, (ctx) => {
  const userId = ctx.from.id.toString();
  db.sessions.delete(userId);
  
  ctx.replyWithHTML(
    `<blockquote>❌ PROSES DIBATALKAN</blockquote>\n\n` +
    `Proses face swap telah dibatalkan.\n\n` +
    `<b>Semua data sementara telah dihapus.</b>\n\n` +
    `Kirim <b>2 foto baru</b> untuk memulai face swap baru! 📸\n\n` +
    `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// CALLBACK HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════
bot.action(/^verify_(.+)$/, async (ctx) => {
  const userId = ctx.match[1];
  
  if (userId !== ctx.from.id.toString()) {
    return ctx.answerCbQuery('❌ Bukan untukmu!', { show_alert: true });
  }
  
  await ctx.answerCbQuery('⏳ Memeriksa membership...');
  
  try {
    const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, userId);
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);
    
    if (isMember) {
      db.users.set(userId, {
        id: userId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        isMember: true,
        verifiedAt: Date.now(),
        joinDate: new Date().toISOString()
      });
      
      await ctx.editMessageText(
        `<blockquote>✅ VERIFIKASI BERHASIL</blockquote>\n\n` +
        `Selamat datang di <b>Face Swap VIP Bot</b>! 🎉\n\n` +
        `Kamu sekarang memiliki akses penuh ke semua fitur premium.\n\n` +
        `Klik /start untuk melihat menu utama dan panduan penggunaan.`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.answerCbQuery(
        '❌ Kamu belum join channel! Klik "Join Channel VIP" dulu ya.',
        { show_alert: true }
      );
    }
  } catch (error) {
    await ctx.answerCbQuery('❌ Error verifikasi. Coba lagi!', { show_alert: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
bot.command('broadcast', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id.toString())) {
    return ctx.reply('❌ Hanya admin yang dapat menggunakan perintah ini!');
  }
  
  const text = ctx.message.text.slice(11).trim();
  if (!text) return ctx.reply('Format: /broadcast [pesan Anda]');
  
  let success = 0;
  let failed = 0;
  
  await ctx.reply('📤 Mengirim broadcast...');
  
  for (const [userId] of db.users) {
    try {
      await ctx.telegram.sendMessage(
        userId,
        `<blockquote>📢 PENGUMUMAN DARI ADMIN</blockquote>\n\n${text}`,
        { parse_mode: 'HTML' }
      );
      success++;
      await new Promise(r => setTimeout(r, 50));
    } catch (e) {
      failed++;
    }
  }
  
  await ctx.replyWithHTML(
    `<blockquote>📊 BROADCAST SELESAI</blockquote>\n\n` +
    `✅ Berhasil dikirim: <b>${success}</b> user\n` +
    `❌ Gagal dikirim: <b>${failed}</b> user\n` +
    `📊 Total: <b>${success + failed}</b> user`
  );
});

bot.command('stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id.toString())) {
    return ctx.reply('❌ Hanya admin!');
  }
  
  let totalSwaps = 0;
  for (const s of db.stats.values()) totalSwaps += s.count;
  
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  await ctx.replyWithHTML(
    `<blockquote>📊 STATISTIK BOT — ADMIN PANEL</blockquote>\n\n` +
    `<b>👥 Pengguna:</b>\n` +
    `├ Total Users: <b>${db.users.size}</b>\n` +
    `├ Active Sessions: <b>${db.sessions.size}</b>\n\n` +
    `<b>🎭 Aktivitas:</b>\n` +
    `├ Total Face Swap: <b>${totalSwaps}</b>\n` +
    `├ Rata-rata per User: <b>${db.users.size ? (totalSwaps / db.users.size).toFixed(1) : 0}</b>\n\n` +
    `<b>⚙️ Sistem:</b>\n` +
    `├ Uptime: <b>${hours}j ${minutes}m</b>\n` +
    `├ Memory Usage: <b>${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB</b>\n` +
    `├ Node Version: <b>${process.version}</b>\n` +
    `└ Platform: <b>${process.platform}</b>\n\n` +
    `<blockquote>💎 Face Swap VIP Bot v2.0</blockquote>`
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function updateUserStats(userId) {
  const id = userId.toString();
  const current = db.stats.get(id) || { count: 0, lastUsed: null };
  
  db.stats.set(id, {
    count: current.count + 1,
    lastUsed: new Date().toISOString()
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING & STARTUP
// ═══════════════════════════════════════════════════════════════════════════════
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err.message);
  
  ctx.replyWithHTML(
    `<blockquote>⚠️ SYSTEM ERROR</blockquote>\n\n` +
    `Terjadi kesalahan tak terduga. Silakan coba lagi.\n\n` +
    `Jika error berlanjut, hubungi admin melalui channel ${REQUIRED_CHANNEL}`
  ).catch(() => {});
});

// Cleanup expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of db.sessions) {
    if (now - session.timestamp > 300000) {
      db.sessions.delete(userId);
    }
  }
}, 300000);

// Start
console.log('╔════════════════════════════════════════════════╗');
console.log('║     🎭 FACE SWAP VIP BOT v2.0                  ║');
console.log('║     Powered by IkyyOfficial API                ║');
console.log('╚════════════════════════════════════════════════╝');
console.log(`📅 ${new Date().toLocaleString('id-ID')}`);
console.log(`📢 Channel: ${REQUIRED_CHANNEL}`);

bot.launch()
  .then(() => console.log('✅ Bot running successfully!'))
  .catch(err => {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const { Telegraf } = require('telegraf');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const BOT_TOKEN = '8711805583:AAHrTijLArxZS_xQOHzXSi_Vx6bBSUW8zX4';
const REQUIRED_CHANNEL = '@StoreRealll';
const OWNER_NAME = 'Jarr';
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
// PROGRESS STEPS (Disesuaikan dengan kecepatan API real)
// ═══════════════════════════════════════════════════════════════════════════════
const PROCESS_STEPS = [
  { percent: 5, text: '🔍 Mendeteksi wajah pada kedua foto...', icon: '👤', delay: 2000 },
  { percent: 12, text: '📥 Mengunduh data foto dari server Telegram...', icon: '⬇️', delay: 2500 },
  { percent: 20, text: '📤 Mengirim data ke AI Engine IkyyOfficial...', icon: '📡', delay: 3000 },
  { percent: 30, text: '⏳ AI sedang menganalisis fitur wajah sumber...', icon: '🤖', delay: 5000 },
  { percent: 42, text: '⏳ Mapping landmark wajah ke target...', icon: '🗺️', delay: 6000 },
  { percent: 55, text: '⏳ Melakukan face swapping process...', icon: '💫', delay: 8000 },
  { percent: 70, text: '⏳ Blending warna & texture matching...', icon: '🎨', delay: 7000 },
  { percent: 82, text: '⏳ Final rendering & quality check...', icon: '⚡', delay: 6000 },
  { percent: 92, text: '📥 Mengambil hasil dari server...', icon: '📥', delay: 5000 },
  { percent: 100, text: '✅ Proses face swap selesai!', icon: '🎉', delay: 2000 }
];

// Total estimasi: ~55 detik (sesuai realitas API)

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
  const elapsed = Math.floor((stepIndex / totalSteps) * 55); // Estimasi 55 detik total
  
  return (
    `<blockquote>🎭 FACE SWAP VIP — ${OWNER_NAME}'s BOT</blockquote>\n\n` +
    `${icon} <b>${text}</b>\n\n` +
    `<code>${bar}</code>\n` +
    `<b>${percent}%</b> Completed — Step [${stepIndex}/${totalSteps}]\n` +
    `⏱ Elapsed: ~${elapsed}s / Est: 55s\n\n` +
    `<i>Mohon tunggu, proses membutuhkan waktu 45-60 detik...</i>\n` +
    `<i>Jangan kirim pesan lain sampai selesai!</i>`
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
        disable_web_page_preview: true',
        disable_web',
        disable_web_page_preview: true
      });
    } catch (err) {
      console.log('Edit error:', err.message);
    }
    
    // Delay antar step
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
        `Untuk menggunakan <b>Face Swap VIP Bot by ${OWNER_NAME}</b>, kamu harus bergabung ke channel kami terlebih dahulu.\n\n` +
        `<b>✨ Keuntungan Member VIP:</b>\n` +
        `├ 🎭 Face Swap Unlimited & HD Quality\n` +
        `├ ⚡ Proses Cepat (45-60 detik)\n` +
        `├ 🚫 No Watermark pada Hasil\n` +
        `├ 🔄 Free Update Fitur Terbaru\n` +
        `└ 💎 Prioritas Support by ${OWNER_NAME}\n\n` +
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
    `Bot Face Swap Premium milik <b>${OWNER_NAME}</b> dengan AI canggih yang dapat menukar wajah antar foto dengan hasil realistis dan berkualitas tinggi.\n\n` +
    `<b>📸 Cara Menggunakan:</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>Langkah 1:</b> Kirim foto <b>SUMBER</b>\n` +
    `   └ Foto wajah yang ingin dipindahkan\n\n` +
    `<b>Langkah 2:</b> Kir>Langkah 2:</b> Kirim foto <b>TARGET</b>\n` +
    `   └ Foto yang wajahnya akan diganti\n\n` +
    `<b>Langkah 3:</b> Tunggu proses selesai\n` +
    `   └ Estimasi waktu: <b>45-60 detik</b>\n\n` +
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
    `<blockquote>💎 ${REQUIRED_CHANNEL} | Owned by ${OWNER_NAME}</blockquote>`,
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
// PHOTO HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
bot.on('photo', checkMembership, async (ctx) => {
  const userId = ctx.from.id.toString();
  const session = db.sessions.get(userId);
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  
  if (session?.step === 'waiting_target') {
    return await processFaceSwap(ctx, session, photo);
  }
  
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
    return await process processFaceSwap(ctx, session, { file_id: doc.file_id });
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
    `<blockquote>💎 Owned by ${OWNER_NAME}</blockquote>`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2: Process Face Swap
// ═══════════════════════════════════════════════════════════════════════════════
async function processFaceSwap(ctx, session, targetPhoto) {
  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id;
  
  db.sessions.set(userId, {
    ...session,
    targetFileId: targetPhoto.file_id,
    step: 'processing'
  });
  
  // Initial message
  const progressMsg = await ctx.replyWithHTML(
    `<blockquote>🎭 FACE SWAP VIP — ${OWNER_NAME}'s BOT</blockquote>\n\n` +
    `⏳ <b>Inisialisasi sistem...</b>\n\n` +
    `<code>░░░░░░░░░░░░░░░░░░░░</code>\n` +
    `<b>0%</b> — Step [0/10]\n` +
    `⏱ Estimasi: 45-60 detik\n\n` +
    `<i>Mohon tunggu, jangan kirim pesan lain...</i>`
  );
  
  // Start animation and API call simultaneously
  const animationPromise = showProgressAnimation(bot, chatId, progressMsg.message_id);
  
  try {
    // Get file URLs
    const sourceFile = await ctx.telegram.getFile(session.sourceFileId);
    const targetFile = await ctx.telegram.getFile(targetPhoto.file_id);
    
    const sourceUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${sourceFile.file_path}`;
    const targetUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${targetFile.file_path}`;
    
    // API call with long timeout (120 detik)
    const apiPromise = axios.get(
      `${FACE_SWAP_API}?source=${encodeURIComponent(sourceUrl)}&target=${encodeURIComponent(targetUrl)}`,
      {
        timeout: 120000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FaceSwapVIP/2.0'
        }
      }
    );
    
    // Wait for both animation and API
    const [_, response] = await Promise.all([animationPromise, apiPromise]);
    
    // Validate response
    if (!response.data?.status || !response.data?.result?.image) {
      throw new Error('Invalid API response');
    }
    
    const resultImageUrl = response.data.result.image;
    const jobId = response.data.result.job_id || 'N/A';
    
    // Download result image
    const imageResponse = await axios.get(resultImageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    // Delete progress message
    await ctx.telegram.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
    
    // Send success result
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
          `├ Processing Time: <b>~50-60 detik</b>\n` +
          `├ AI Engine: <b>IkyyOfficial API</b>\n` +
          `└ Owner: <b>${OWNER_NAME}</b>\n\n` +
          `<b>💾 Simpan Foto Ini!</b>\n` +
          `Foto hasil face swap akan hilang jika tidak disimpan. Tekan dan tahan foto untuk menyimpan ke galeri.\n\n` +
          `<b>🚀 Ingin Face Swap Lagi?</b>\n` +
          `Kirim 2 foto baru (sumber & target) untuk memulai proses baru!\n\n` +
          `<blockquote>💎 ${REQUIRED_CHANNEL} | Owned by ${OWNER_NAME}</blockquote>`
        ),
        parse_mode: 'HTML'
      }
    );
    
    updateStats(ctx.from.id);
    db.sessions.delete(userId);
    
  } catch (error) {
    console.error('Face Swap Error:', error.message);
    
    // Try to stop animation gracefully
    try {
      await ctx.telegram.deleteMessage(chatId, progressMsg.message_id);
    } catch (e) {}
    
    // Detailed error message
    let errorDetail = '';
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorDetail = `⏱ <b>Timeout Error</b>\n\n` +
        `Proses memakan waktu terlalu lama (>120 detik). Ini bisa terjadi karena:\n` +
        `• Server API sedang sibuk/high traffic\n` +
        `• Ukuran foto terlalu besar\n` +
        `• Koneksi internet tidak stabil\n\n` +
        `<b>Solusi:</b>\n` +
        `• Coba lagi dalam 1-2 menit\n` +
        `• Gunakan foto dengan ukuran < 2MB\n` +
        `• Pastikan koneksi internet stabil`;
    } else if (error.response?.status === 400) {
      errorDetail = `🚫 <b>Bad Request</b>\n\n` +
        `Format atau konten foto tidak valid. Pastikan:\n` +
        `• Kedua foto memiliki wajah yang jelas terlihat\n` +
        `• Wajah tidak terlalu kecil dalam frame\n` +
        `• Format foto adalah JPG atau PNG\n` +
        `• Tidak ada multiple faces yang terlalu dominan`;
    } else if (error.response?.status === 500 || error.response?.status === 502) {
      errorDetail = `🔧 <b>Server Error</b>\n\n` +
        `Server API sedang mengalami gangguan. Coba lagi dalam beberapa menit.\n\n` +
        `Status: ${error.response?.status} ${error.response?.statusText}`;
    } else {
      errorDetail = `💥 <b>System Error</b>\n\n` +
        `${error.message}\n\n` +
        `Silakan coba lagi atau hubungi ${OWNER_NAME} melalui channel ${REQUIRED_CHANNEL} jika error berlanjut.`;
    }
    
    await ctx.replyWithHTML(
      `<blockquote>❌ FACE SWAP GAGAL</blockquote>\n\n` +
      `Maaf, terjadi kesalahan saat memproses face swap.\n\n` +
      `${errorDetail}\n\n` +
      `<b>🔄 Coba lagi dengan:</b>\n` +
      `• Foto berbeda dengan kualitas lebih baik\n` +
      `• Pastikan wajah terlihat jelas di kedua foto\n` +
      `• Ukuran file tidak lebih dari 5MB\n` +
      `• Tunggu 1-2 menit jika server sibuk\n\n` +
      `<blockquote>💎 Owned by ${OWNER_NAME}</blockquote>`
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
    `<b>Contoh:</b> Foto selfie kamu, foto artis favorit, dll.\n\n` +
    `<i>Estimasi total waktu: 45-60 detik untuk 2 foto</i>`
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
    `• Tunggu animasi progress 0% sampai 100%\n` +
    `• <b>Estimasi waktu: 45-60 detik</b>\n\n` +
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
    `<b>💡 Pro Tips by ${OWNER_NAME}:</b>\n` +
    `• Gunakan foto dengan ekspresi netral untuk hasil terbaik\n` +
    `• Pencahayaan yang sama pada kedua foto = hasil lebih bagus\n` +
    `• Wajah dengan sudut serupa (depan/depan atau samping/samping)\n` +
    `• Jika gagal, coba crop foto agar wajah lebih dominan\n\n` +
    `<blockquote>💎 Owned by ${OWNER_NAME}</blockquote>`
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
    `├ Member Sejak: <b>${user ? new Date(user.joinDate).toLocaleDateString('id-ID') : '-'}</b>\ `n• Tunggu animasi progress 0% sampai 100%\n` +
    `• <b>Estimasi waktu: 45-60 detik</b>\n\n` +
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
    `<b>💡 Pro Tips by ${OWNER_NAME}:</b>\n` +
    `• Gunakan foto dengan ekspresi netral untuk hasil terbaik\n` +
    `• Pencahayaan yang sama pada kedua foto = hasil lebih bagus\n` +
    `• Wajah dengan sudut serupa (depan/depan atau samping/samping)\n` +
    `• Jika gagal, coba crop foto agar wajah lebih dominan\n\n` +
    `<blockquote>💎 Owned by ${OWNER_NAME}</blockquote>`
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
    `├ Kualitas: <b>HD Premium</b>\n` +
    `└ Bot Owner: <b>${OWNER_NAME}</b>\n\n` +
    `<b>🎭 Siap untuk face swap selanjutnya!</b>\n\n` +
    `<blockquote>💎 Owned by ${OWNER_NAME}</blockquote>`
  );
});

bot.hears('📢 Channel VIP', (ctx) => {
  const channelName = REQUIRED_CHANNEL.replace('@', '');
  ctx.replyWithHTML(
    `<blockquote>📢 CHANNEL VIP COMMUNITY</blockquote>\n\n` +
    `Bergabunglah dengan channel kami untuk:\n` +
    `• 📢 Update fitur terbaru dari ${OWNER_NAME}\n` +
    `• 🎁 Giveaway & event spesial\n` +
    `• 💬 Komunitas pengguna bot\n` +
    `• 🆘 Bantuan & support 24/7\n\n` +
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
    `<blockquote>💎 Owned by ${OWNER_NAME}</blockquote>`
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// CALLBACK & ADMIN
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
        `Selamat datang di <b>Face Swap VIP Bot by ${OWNER_NAME}</b>! 🎉\n\n` +
        `Kamu sekarang memiliki akses penuh ke semua fitur premium.\n\n` +
        `Klik /start untuk melihat menu utama dan panduan penggunaan.`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.answerCbQuery('❌ Kamu belum join channel! Klik "Join Channel VIP" dulu ya.', { show_alert: true });
    }
  } catch (error) {
    await ctx.answerCbQuery('❌ Error verifikasi. Coba lagi!', { show_alert: true });
  }
});

bot.command('broadcast', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id.toString())) return ctx.reply('❌ Hanya admin!');
  
  const text = ctx.message.text.slice(11).trim();
  if (!text) return ctx.reply('Format: /broadcast [pesan]');
  
  let success = 0, failed = 0;
  
  for (const [userId] of db.users) {
    try {
      await ctx.telegram.sendMessage(userId,
        `<blockquote>📢 PENGUMUMAN DARI ${OWNER_NAME}</blockquote>\n\n${text}`,
        { parse_mode: 'HTML' }
      );
      success++;
      await new Promise(r => setTimeout(r, 50));
    } catch (e) { failed++; }
  }
  
  await ctx.reply(`📊 Broadcast:\n✅ ${success} berhasil\n❌ ${failed} gagal`);
});

bot.command('stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id.toString())) return ctx.reply('❌ Hanya admin!');
  
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
    `├ Memory: <b>${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB</b>\n` +
    `├ Owner: <b>${OWNER_NAME}</b>\n` +
    `└ API: <b>IkyyOfficial</b>\n\n` +
    `<blockquote>💎 Face Swap VIP Bot v2.0 by ${OWNER_NAME}</blockquote>`
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS & STARTUP
// ═══════════════════════════════════════════════════════════════════════════════
function updateStats(userId) {
  const id = userId.toString();
  const current = db.stats.get(id) || { count: 0, lastUsed: null };
  db.stats.set(id, { count: current.count + 1, lastUsed: new Date().toISOString() });
}

bot.catch((err, ctx) => {
  console.error(`Error:`, err.message);
  ctx.replyWithHTML(
    `<blockquote>⚠️ SYSTEM ERROR</blockquote>\n\n` +
    `Terjadi kesalahan. Silakan coba lagi.\n\n` +
    `Hubungi ${OWNER_NAME} di ${REQUIRED_CHANNEL} jika berlanjut.`
  ).catch(() => {});
});

setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of db.sessions) {
    if (now - session.timestamp > 300000) db.sessions.delete(userId);
  }
}, 300000);

console.log('╔════════════════════════════════════════════════╗');
console.log(`║     🎭 FACE SWAP VIP BOT v2.0                  ║`);
console.log(`║     Owner: ${OWNER_NAME}                          ║`);
console.log(`║     API: IkyyOfficial                          ║`);
console.log('╚════════════════════════════════════════════════╝');

bot.launch()
  .then(() => console.log('✅ Bot running!'))
  .catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

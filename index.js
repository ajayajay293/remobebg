const { Telegraf } = require('telegraf');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const BOT_TOKEN = '8711805583:AAHrTijLArxZS_xQOHzXSi_Vx6bBSUW8zX4';
const REQUIRED_CHANNEL = '@StoreRealll';
const ADMIN_IDS = ['6816905895']; // Ganti dengan ID admin Anda

// API Face Swap
const FACE_SWAP_API = 'https://api.vreden.my.id/api/v1/artificial/imgedit/faceswap';

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE (Memory)
// ═══════════════════════════════════════════════════════════════════════════════
const db = {
  users: new Map(),
  sessions: new Map(),
  stats: new Map()
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION FRAMES FOR PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════
const PROCESSING_ANIMATION = {
  frames: ['⏳', '⌛', '⏳', '⌛', '🔄', '🔃', '🔄', '🔃'],
  interval: 800
};

// Progress steps for Face Swap
const FACE_SWAP_STEPS = [
  { percent: 0, text: '🔍 Mendeteksi wajah pada foto...', icon: '👤', delay: 1500 },
  { percent: 15, text: '📥 Mengunduh foto sumber & target...', icon: '⬇️', delay: 2000 },
  { percent: 30, text: '🎯 AI menganalisis fitur wajah...', icon: '🧠', delay: 2500 },
  { percent: 45, text: '🎭 Mapping wajah ke target...', icon: '🗺️', delay: 2000 },
  { percent: 60, text: '✨ Melakukan face swapping...', icon: '✨', delay: 3000 },
  { percent: 75, text: '🔧 Blending & color matching...', icon: '🎨', delay: 2500 },
  { percent: 90, text: '📤 Mengunggah hasil akhir...', icon: '⬆️', delay: 2000 },
  { percent: 100, text: '✅ Proses selesai!', icon: '🎉', delay: 1000 }
];

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Create visual progress bar
function createProgressBar(percent) {
  const totalBlocks = 20;
  const filledBlocks = Math.round((percent / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  
  const filled = '█'.repeat(filledBlocks);
  const empty = '░'.repeat(emptyBlocks);
  
  return `${filled}${empty}`;
}

// Format progress message
function formatProgressMessage(step, totalSteps, percent, currentText, icon) {
  const bar = createProgressBar(percent);
  const stepCounter = `[${step}/${totalSteps}]`;
  
  return (
    `<blockquote>🎭 FACE SWAP VIP PROCESS</blockquote>\n\n` +
    `${icon} <b>${currentText}</b>\n\n` +
    `<code>${bar}</code>\n` +
    `<b>${percent}%</b> ${stepCounter}\n\n` +
    `<i>⏱ Mohon tunggu, jangan kirim pesan lain...</i>\n` +
    `<i>Estimasi: ~10-15 detik</i>`
  );
}

// Show animated progress
async function showAnimatedProgress(bot, chatId, messageId) {
  const totalSteps = FACE_SWAP_STEPS.length;
  
  for (let i = 0; i < totalSteps; i++) {
    const step = FACE_SWAP_STEPS[i];
    const text = formatProgressMessage(i + 1, totalSteps, step.percent, step.text, step.icon);
    
    try {
      await bot.telegram.editMessageText(chatId, messageId, null, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    } catch (err) {
      // Ignore edit errors (message too old, etc)
      console.log('Edit message error:', err.message);
    }
    
    // Wait for specified delay
    await new Promise(resolve => setTimeout(resolve, step.delay));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
const bot = new Telegraf(BOT_TOKEN);

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBERSHIP CHECK MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════
async function checkMembership(ctx, next) {
  const userId = ctx.from.id.toString();
  
  // Admin bypass
  if (ADMIN_IDS.includes(userId)) {
    return next();
  }
  
  // Check cache (30 minutes)
  const cached = db.users.get(userId);
  const cacheValid = cached && (Date.now() - cached.verifiedAt < 1800000);
  
  if (cacheValid && cached.isMember) {
    return next();
  }
  
  try {
    let isMember = false;
    
    // Try to check membership
    try {
      const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, userId);
      isMember = ['member', 'administrator', 'creator'].includes(member.status);
    } catch (e) {
      console.log('Channel check error:', e.message);
      // If channel private, use cached status or false
      isMember = cached?.isMember || false;
    }
    
    if (!isMember) {
      const channelName = REQUIRED_CHANNEL.replace('@', '');
      
      return ctx.replyWithHTML(
        `<blockquote>🔒 AKSES DITOLAK</blockquote>\n\n` +
        `Halo <b>${ctx.from.first_name}</b>! 👋\n\n` +
        `Kamu harus bergabung ke channel kami terlebih dahulu untuk menggunakan bot ini.\n\n` +
        `<b>✨ Benefit Member VIP:</b>\n` +
        `• Face Swap Unlimited\n` +
        `• Kualitas HD\n` +
        `• Proses Cepat\n` +
        `• No Watermark\n\n` +
        `👇 <b>Join sekarang:</b>`,
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
    
    // Save to database
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
    console.error('Membership check error:', error);
    return ctx.reply('❌ Terjadi kesalahan sistem. Coba lagi nanti.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// /START COMMAND
// ═══════════════════════════════════════════════════════════════════════════════
bot.command('start', checkMembership, async (ctx) => {
  const user = ctx.from;
  const userStats = db.stats.get(user.id.toString()) || { count: 0 };
  
  await ctx.replyWithHTML(
    `<blockquote>🎭 FACE SWAP VIP BOT</blockquote>\n\n` +
    `Selamat datang, <b>${user.first_name}</b>! ✨\n\n` +
    `<b>🤖 Bot Face Swap Premium</b>\n\n` +
    `<b>📸 Cara Penggunaan:</b>\n\n` +
    `<b>Langkah 1:</b>\n` +
    `Kirim foto <b>SUMBER</b> (wajah yang ingin dipindahkan)\n\n` +
    `<b>Langkah 2:</b>\n` +
    `Kirim foto <b>TARGET</b> (foto yang wajahnya akan diganti)\n\n` +
    `<b>✨ Tips Hasil Maksimal:</b>\n` +
    `• Wajah terlihat jelas & frontal\n` +
    `• Pencahayaan bagus\n` +
    `• Hindari wajah tertutup (masker/kacamata)\n` +
    `• Foto berwarna lebih baik dari hitam putih\n\n` +
    `<b>📊 Statistik Kamu:</b> ${userStats.count}x Face Swap\n\n` +
    `<blockquote>💎 Powered by ${REQUIRED_CHANNEL}</blockquote>`,
    {
      reply_markup: {
        keyboard: [
          ['📸 Mulai Face Swap', '❓ Cara Pakai'],
          ['📊 Status Saya', '📢 Channel VIP']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    }
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PHOTO HANDLER - FACE SWAP LOGIC
// ═══════════════════════════════════════════════════════════════════════════════
bot.on('photo', checkMembership, async (ctx) => {
  const userId = ctx.from.id.toString();
  const session = db.sessions.get(userId);
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  
  // STEP 2: If waiting for target photo
  if (session?.step === 'waiting_target') {
    return await processFaceSwapStep2(ctx, session, photo);
  }
  
  // STEP 1: New photo - treat as source
  await processFaceSwapStep1(ctx, photo);
});

// Handle document (photo as file)
bot.on('document', checkMembership, async (ctx) => {
  const doc = ctx.message.document;
  
  // Validate image
  if (!doc.mime_type || !doc.mime_type.startsWith('image/')) {
    return ctx.replyWithHTML(
      `<blockquote>❌ Format Tidak Valid</blockquote>\n\n` +
      `Kirim file gambar ya (JPG, PNG, WEBP)! 📸`
    );
  }
  
  const userId = ctx.from.id.toString();
  const session = db.sessions.get(userId);
  
  // STEP 2: If waiting for target
  if (session?.step === 'waiting_target') {
    return await processFaceSwapStep2(ctx, session, { file_id: doc.file_id, file_unique_id: doc.file_unique_id });
  }
  
  // STEP 1: New photo
  await processFaceSwapStep1(ctx, { 
    file_id: doc.file_id, 
    file_unique_id: doc.file_unique_id,
    width: 'Unknown',
    height: 'Unknown'
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1: Receive Source Photo
// ═══════════════════════════════════════════════════════════════════════════════
async function processFaceSwapStep1(ctx, photo) {
  const userId = ctx.from.id.toString();
  
  // Save session
  db.sessions.set(userId, {
    step: 'waiting_target',
    sourceFileId: photo.file_id,
    sourceUniqueId: photo.file_unique_id,
    timestamp: Date.now()
  });
  
  // Get file info if available
  const width = photo.width || '?';
  const height = photo.height || '?';
  const size = photo.file_size ? `(${(photo.file_size / 1024).toFixed(1)} KB)` : '';
  
  await ctx.replyWithHTML(
    `<blockquote>✅ FOTO SUMBER DITERIMA</blockquote>\n\n` +
    `👤 <b>Foto 1/2 - Wajah Sumber</b>\n` +
    `📐 Resolusi: ${width}x${height} ${size}\n\n` +
    `<b>🎯 Langkah Selanjutnya:</b>\n` +
    `Kirim foto <b>TARGET</b> sekarang!\n\n` +
    `(Foto yang wajahnya ingin kamu ganti)\n\n` +
    `⏳ <i>Menunggu foto kedua...</i>\n\n` +
    `💡 <i>Ketik "batal" kapan saja untuk membatalkan</i>`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2: Receive Target Photo & Process
// ═══════════════════════════════════════════════════════════════════════════════
async function processFaceSwapStep2(ctx, session, targetPhoto) {
  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id;
  
  // Get target info
  const width = targetPhoto.width || '?';
  const height = targetPhoto.height || '?';
  
  // Update session
  db.sessions.set(userId, {
    ...session,
    targetFileId: targetPhoto.file_id,
    targetUniqueId: targetPhoto.file_unique_id,
    step: 'processing'
  });
  
  // Send initial processing message
  const progressMsg = await ctx.replyWithHTML(
    `<blockquote>🎭 FACE SWAP VIP PROCESS</blockquote>\n\n` +
    `⏳ <b>Memulai proses...</b>\n\n` +
    `<code>░░░░░░░░░░░░░░░░░░░░</code>\n` +
    `<b>0%</b> [0/8]\n\n` +
    `<i>⏱ Mohon tunggu, jangan kirim pesan lain...</i>`
  );
  
  try {
    // Get file URLs from Telegram
    const sourceFile = await ctx.telegram.getFile(session.sourceFileId);
    const targetFile = await ctx.telegram.getFile(targetPhoto.file_id);
    
    const sourceUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${sourceFile.file_path}`;
    const targetUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${targetFile.file_path}`;
    
    // Show animated progress
    await showAnimatedProgress(bot, chatId, progressMsg.message_id);
    
    // Call Face Swap API
    const apiUrl = `${FACE_SWAP_API}?from_url=${encodeURIComponent(sourceUrl)}&to_url=${encodeURIComponent(targetUrl)}`;
    
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 120000, // 2 minutes timeout
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'FaceSwapBot/1.0'
      }
    });
    
    // Delete progress message
    await ctx.telegram.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
    
    // Send success message with result
    await ctx.replyWithPhoto(
      { source: Buffer.from(response.data) },
      {
        caption: (
          `<blockquote>✅ FACE SWAP BERHASIL</blockquote>\n\n` +
          `🎭 Wajah berhasil ditukar!\n\n` +
          `<b>📊 Detail:</b>\n` +
          `• Sumber: <code>${session.sourceUniqueId?.slice(-8) || 'N/A'}</code>\n` +
          `• Target: <code>${targetPhoto.file_unique_id?.slice(-8) || 'N/A'}</code>\n` +
          `• Resolusi: ${width}x${height}\n\n` +
          `💾 <i>Save foto ini sebelum hilang!</i>\n\n` +
          `<b>Kirim 2 foto lagi untuk face swap baru 📸</b>\n\n` +
          `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`
        ),
        parse_mode: 'HTML'
      }
    );
    
    // Update stats
    updateStats(ctx.from.id);
    
    // Clear session
    db.sessions.delete(userId);
    
  } catch (error) {
    console.error('Face Swap Error:', error.message);
    
    // Delete progress message
    await ctx.telegram.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
    
    // Error message
    let errorMsg = (
      `<blockquote>❌ FACE SWAP GAGAL</blockquote>\n\n` +
      `Maaf, terjadi kesalahan saat memproses.\n\n`
    );
    
    if (error.code === 'ECONNABORTED') {
      errorMsg += `⏱ <b>Timeout:</b> Server terlalu lama merespons.\nCoba lagi dengan foto lebih kecil.`;
    } else if (error.response?.status === 400) {
      errorMsg += `🚫 <b>Bad Request:</b> Format foto tidak didukung atau wajah tidak terdeteksi.\n\nPastikan:\n• Kedua foto memiliki wajah yang jelas\n• Wajah tidak terlalu kecil\n• Format JPG/PNG`;
    } else {
      errorMsg += `💥 <b>Error:</b> ${error.message}\n\nCoba lagi nanti atau hubungi admin.`;
    }
    
    errorMsg += `\n\n<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`;
    
    await ctx.replyWithHTML(errorMsg);
    
    // Clear session on error
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
    `(Foto wajah yang ingin kamu pindahkan ke foto lain)`
  );
});

bot.hears('❓ Cara Pakai', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>📖 PANDUAN FACE SWAP</blockquote>\n\n` +
    `<b>🎯 Tutorial Lengkap:</b>\n\n` +
    `<b>1️⃣ Kirim Foto Pertama (Sumber)</b>\n` +
    `   Foto wajah kamu atau siapa saja\n\n` +
    `<b>2️⃣ Kirim Foto Kedua (Target)</b>\n` +
    `   Foto yang wajahnya mau diganti\n\n` +
    `<b>3️⃣ Tunggu Proses</b>\n` +
    `   Bot akan otomatis memproses dengan animasi progress\n\n` +
    `<b>4️⃣ Dapatkan Hasil</b>\n` +
    `   Foto hasil face swap siap disimpan!\n\n` +
    `<b>⚠️ Tips Sukses:</b>\n` +
    `• Wajah harus terlihat jelas (tidak blur)\n` +
    `• Pencahayaan cukup terang\n` +
    `• Posisi wajah frontal (depan)\n` +
    `• Hindari wajah tertutup masker/kacamata hitam\n` +
    `• Ukuran wajah tidak terlalu kecil di foto\n\n` +
    `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`
  );
});

bot.hears('📊 Status Saya', checkMembership, (ctx) => {
  const userId = ctx.from.id.toString();
  const user = db.users.get(userId);
  const stats = db.stats.get(userId) || { count: 0, lastUsed: '-' };
  
  ctx.replyWithHTML(
    `<blockquote>📊 STATUS PENGGUNA</blockquote>\n\n` +
    `👤 <b>Nama:</b> ${ctx.from.first_name}\n` +
    `🆔 <b>ID:</b> <code>${ctx.from.id}</code>\n` +
    `📅 <b>Member Sejak:</b> ${user ? new Date(user.joinDate).toLocaleDateString('id-ID') : '-'}\n\n` +
    `<b>📈 Statistik Face Swap:</b>\n` +
    `• Total Penggunaan: <b>${stats.count}x</b>\n` +
    `• Terakhir Digunakan: ${stats.lastUsed !== '-' ? new Date(stats.lastUsed).toLocaleString('id-ID') : '-'}\n` +
    `• Status: <b>✅ VIP Active</b>\n\n` +
    `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`
  );
});

bot.hears('📢 Channel VIP', (ctx) => {
  const channelName = REQUIRED_CHANNEL.replace('@', '');
  ctx.replyWithHTML(
    `<blockquote>📢 CHANNEL VIP</blockquote>\n\n` +
    `Join channel kami untuk update fitur terbaru!`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔔 Join Channel', url: `https://t.me/${channelName}` }]
        ]
      }
    }
  );
});

// Cancel command
bot.hears(['batal', 'Batal', '❌ Batal', 'cancel', 'Cancel'], checkMembership, (ctx) => {
  const userId = ctx.from.id.toString();
  db.sessions.delete(userId);
  
  ctx.replyWithHTML(
    `<blockquote>❌ DIBATALKAN</blockquote>\n\n` +
    `Proses face swap dibatalkan.\n\n` +
    `Kirim <b>2 foto baru</b> untuk memulai lagi! 📸`
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
        `Selamat datang di <b>Face Swap VIP</b>! 🎉\n\n` +
        `Klik /start untuk mulai menggunakan bot.`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.answerCbQuery(
        '❌ Kamu belum join channel!\nKlik tombol Join Channel dulu ya.',
        { show_alert: true }
      );
    }
  } catch (error) {
    console.error('Verify error:', error);
    await ctx.answerCbQuery('❌ Error verifikasi. Coba lagi!', { show_alert: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
bot.command('broadcast', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id.toString())) {
    return ctx.reply('❌ Hanya admin!');
  }
  
  const text = ctx.message.text.slice(11).trim();
  if (!text) return ctx.reply('Format: /broadcast [pesan]');
  
  let success = 0;
  let failed = 0;
  
  for (const [userId] of db.users) {
    try {
      await ctx.telegram.sendMessage(
        userId,
        `<blockquote>📢 PENGUMUMAN</blockquote>\n\n${text}`,
        { parse_mode: 'HTML' }
      );
      success++;
      await new Promise(r => setTimeout(r, 100)); // Anti flood
    } catch (e) {
      failed++;
    }
  }
  
  await ctx.reply(`📊 Broadcast:\n✅ ${success} berhasil\n❌ ${failed} gagal`);
});

bot.command('stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id.toString())) {
    return ctx.reply('❌ Hanya admin!');
  }
  
  let totalSwaps = 0;
  for (const s of db.stats.values()) {
    totalSwaps += s.count;
  }
  
  await ctx.replyWithHTML(
    `<blockquote>📊 STATISTIK BOT</blockquote>\n\n` +
    `👥 Total Users: <b>${db.users.size}</b>\n` +
    `🎭 Total Face Swap: <b>${totalSwaps}</b>\n` +
    `⏱ Uptime: <b>${(process.uptime() / 3600).toFixed(2)} jam</b>\n` +
    `🧠 Memory: <b>${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB</b>`
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function updateStats(userId) {
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
    `<blockquote>⚠️ ERROR</blockquote>\n\n` +
    `Terjadi kesalahan. Silakan coba lagi.\n\n` +
    `Jika error berlanjut, hubungi admin.`
  ).catch(() => {});
});

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of db.sessions) {
    if (now - session.timestamp > 300000) { // 5 minutes
      db.sessions.delete(userId);
    }
  }
}, 300000);

// Start bot
console.log('╔════════════════════════════════════════╗');
console.log('║     🤖 FACE SWAP VIP BOT v1.0          ║');
console.log('║     Starting...                        ║');
console.log('╚════════════════════════════════════════╝');
console.log(`📅 ${new Date().toLocaleString('id-ID')}`);
console.log(`📢 Channel: ${REQUIRED_CHANNEL}`);
console.log(`🔑 Admin IDs: ${ADMIN_IDS.join(', ')}`);

bot.launch()
  .then(() => {
    console.log('✅ Bot berhasil dijalankan!');
    console.log('🎭 Siap menerima face swap requests...');
  })
  .catch(err => {
    console.error('❌ Gagal start bot:', err.message);
    process.exit(1);
  });

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n🛑 SIGINT received. Shutting down...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received. Shutting down...');
  bot.stop('SIGTERM');
});

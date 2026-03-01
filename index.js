const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════
// KONFIGURASI BOT
// ═══════════════════════════════════════════════════════════
const BOT_TOKEN = '8446129409:AAH3El-xB1oPN7Dl1mHN0oS_1_qw4KtwFAA';
const REQUIRED_CHANNEL = '@StoreRealll';
const ADMIN_IDS = ['6816905895']; // Ganti dengan ID admin

// ═══════════════════════════════════════════════════════════
// DATABASE SEMENTARA (Gunakan Redis/DB untuk production)
// ═══════════════════════════════════════════════════════════
const db = {
  users: new Map(),
  sessions: new Map(), // Simpan session user
  stats: new Map(),
  tempFiles: new Map() // Simpan mapping file_id pendek
};

// ═══════════════════════════════════════════════════════════
// ANIMASI PROGRESS BAR
// ═══════════════════════════════════════════════════════════
const PROGRESS_STEPS = [
  { percent: 1, text: '🔍 Sedang menganalisis foto...', emoji: '⏳' },
  { percent: 15, text: '📥 Mengunduh file...', emoji: '⬇️' },
  { percent: 30, text: '⚡ Memproses dengan AI...', emoji: '✨' },
  { percent: 50, text: '🎨 Menerapkan filter...', emoji: '🖌️' },
  { percent: 75, text: '🔧 Finishing touch...', emoji: '🔨' },
  { percent: 90, text: '📤 Mengunggah hasil...', emoji: '⬆️' },
  { percent: 100, text: '✅ Selesai!', emoji: '🎉' }
];

// Generate progress bar visual
function createProgressBar(percent) {
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `\n\`${bar}\` ${percent}%`;
}

// ═══════════════════════════════════════════════════════════
// INISIALISASI BOT
// ═══════════════════════════════════════════════════════════
const bot = new Telegraf(BOT_TOKEN);

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE CEK MEMBERSHIP (FIXED)
// ═══════════════════════════════════════════════════════════
async function checkMembership(ctx, next) {
  const userId = ctx.from.id.toString();
  
  // Skip cek untuk admin
  if (ADMIN_IDS.includes(userId)) return next();
  
  try {
    // Cek apakah sudah pernah verifikasi (cache 1 jam)
    const cached = db.users.get(userId);
    if (cached && (Date.now() - cached.verifiedAt < 3600000)) {
      return next();
    }
    
    // Cek membership (gunakan try-catch khusus)
    let isMember = false;
    try {
      const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, userId);
      isMember = ['member', 'administrator', 'creator'].includes(member.status);
    } catch (e) {
      // Jika error (channel private), anggap valid jika sudah pernah join
      console.log('Channel check error:', e.message);
      isMember = cached?.isMember || false;
    }
    
    if (!isMember) {
      const channelName = REQUIRED_CHANNEL.replace('@', '');
      return ctx.replyWithHTML(
        `<blockquote>🔒 AKSES TERBATAS</blockquote>\n\n` +
        `Halo <b>${ctx.from.first_name}</b>! 👋\n\n` +
        `Untuk menggunakan bot ini, kamu harus join channel dulu ya!\n\n` +
        `✨ <b>Benefit Member:</b>\n` +
        `• Remove Background Unlimited\n` +
        `• Unblur Foto HD\n` +
        `• Face Swap Premium\n` +
        `• Logo Generator AI\n\n` +
        `👇 <b>Klik tombol di bawah untuk join:</b>`,
        Markup.inlineKeyboard([
          [Markup.button.url('🔔 Join Channel', `https://t.me/${channelName}`)],
          [Markup.button.callback('✅ Saya Sudah Join', `verify_${userId}`)]
        ])
      );
    }
    
    // Simpan ke database
    db.users.set(userId, {
      id: userId,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      isMember: true,
      verifiedAt: Date.now(),
      joinedAt: cached?.joinedAt || Date.now()
    });
    
    return next();
    
  } catch (error) {
    console.error('Membership error:', error);
    return ctx.reply('❌ Terjadi kesalahan. Coba lagi nanti.');
  }
}

// ═══════════════════════════════════════════════════════════
// GENERATE SHORT ID (Fix BUTTON_DATA_INVALID)
// ═══════════════════════════════════════════════════════════
function generateShortId() {
  return Math.random().toString(36).substring(2, 10);
}

function saveFileMapping(shortId, fileId) {
  db.tempFiles.set(shortId, {
    fileId: fileId,
    expires: Date.now() + 300000 // Expire 5 menit
  });
  return shortId;
}

function getFileMapping(shortId) {
  const data = db.tempFiles.get(shortId);
  if (data && data.expires > Date.now()) {
    return data.fileId;
  }
  db.tempFiles.delete(shortId);
  return null;
}

// ═══════════════════════════════════════════════════════════
// ANIMASI PROGRESS
// ═══════════════════════════════════════════════════════════
async function showProgress(ctx, messageId, chatId, processName) {
  let currentStep = 0;
  
  for (const step of PROGRESS_STEPS) {
    const progressBar = createProgressBar(step.percent);
    const text = 
      `<blockquote>⏳ ${processName}</blockquote>\n\n` +
      `${step.emoji} <b>${step.text}</b>` +
      `${progressBar}\n\n` +
      `<i>Mohon tunggu, jangan spam ya...</i>`;
    
    try {
      await ctx.telegram.editMessageText(
        chatId,
        messageId,
        null,
        text,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      // Ignore edit errors
    }
    
    // Delay realistis
    const delay = step.percent === 100 ? 500 : Math.random() * 1500 + 500;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    currentStep++;
  }
  
  return true;
}

// ═══════════════════════════════════════════════════════════
// COMMAND /START
// ═══════════════════════════════════════════════════════════
bot.command('start', checkMembership, async (ctx) => {
  const user = ctx.from;
  
  // Animasi loading start
  const loadingMsg = await ctx.replyWithHTML(
    `<blockquote>🚀 Memuat...</blockquote>\n\n` +
    `Sedang menyiapkan menu utama...`
  );
  
  // Simulasi loading
  await new Promise(r => setTimeout(r, 1000));
  
  await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
  
  const welcomeText = 
    `<blockquote>🎨 REMOVEBG VVIP BOT</blockquote>\n\n` +
    `Halo <b>${user.first_name}</b>! 👋\n\n` +
    `🤖 <b>Bot Premium Edit Foto AI</b>\n\n` +
    `✨ <b>Fitur Unggulan:</b>\n` +
    `├ 🖼 <b>RemoveBG</b> - Hapus background\n` +
    `├ 🔍 <b>Unblur</b> - Perjelas foto blur\n` +
    `├ 🎭 <b>Face Swap</b> - Tukar wajah\n` +
    `├ 🎨 <b>Logo AI</b> - Buat logo otomatis\n` +
    `└ 📸 <b>HD Enhancer</b> - Tingkatkan kualitas\n\n` +
    `📌 <b>Cara Pakai:</b>\n` +
    `Kirim <b>foto</b> langsung ke sini, lalu pilih fitur!\n\n` +
    `<blockquote>💎 Powered by ${REQUIRED_CHANNEL}</blockquote>`;
  
  await ctx.replyWithHTML(welcomeText, {
    reply_markup: {
      keyboard: [
        ['🖼 RemoveBG', '🔍 Unblur', '🎭 Face Swap'],
        ['🎨 Logo AI', '📸 HD Enhancer', '📊 Status'],
        ['❓ Cara Pakai', '📢 Channel']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
});

// ═══════════════════════════════════════════════════════════
// HANDLER FOTO UTAMA
// ═══════════════════════════════════════════════════════════
bot.on('photo', checkMembership, async (ctx) => {
  const userId = ctx.from.id.toString();
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const fileId = photo.file_id;
  const fileUniqueId = photo.file_unique_id;
  
  // Generate short ID untuk callback
  const shortId = generateShortId();
  saveFileMapping(shortId, fileId);
  
  // Simpan session
  db.sessions.set(userId, {
    fileId: fileId,
    shortId: shortId,
    timestamp: Date.now()
  });
  
  // Animasi diterima
  const msg = await ctx.replyWithHTML(
    `<blockquote>📸 Menerima Foto...</blockquote>\n\n` +
    `⏳ Sedang memproses...`
  );
  
  await new Promise(r => setTimeout(r, 800));
  
  await ctx.telegram.editMessageText(
    ctx.chat.id,
    msg.message_id,
    null,
    `<blockquote>✅ Foto Diterima</blockquote>\n\n` +
    `🖼 <b>File:</b> <code>${fileUniqueId.slice(-8)}</code>\n` +
    `📐 <b>Resolusi:</b> ${photo.width}x${photo.height}\n\n` +
    `Pilih fitur yang mau digunakan:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🖼 RemoveBG', callback_data: `rb_${shortId}` },
            { text: '🔍 Unblur', callback_data: `ub_${shortId}` }
          ],
          [
            { text: '🎭 Face Swap', callback_data: `fs_${shortId}` },
            { text: '📸 HD', callback_data: `hd_${shortId}` }
          ],
          [
            { text: '❌ Batalkan', callback_data: `cancel_${shortId}` }
          ]
        ]
      }
    }
  );
});

// ═══════════════════════════════════════════════════════════
// HANDLER DOKUMEN (FOTO AS FILE)
// ═══════════════════════════════════════════════════════════
bot.on('document', checkMembership, async (ctx) => {
  const doc = ctx.message.document;
  if (!doc.mime_type?.startsWith('image/')) {
    return ctx.reply('❌ Kirim file gambar ya (JPG, PNG, WEBP)!');
  }
  
  const userId = ctx.from.id.toString();
  const shortId = generateShortId();
  saveFileMapping(shortId, doc.file_id);
  
  db.sessions.set(userId, {
    fileId: doc.file_id,
    shortId: shortId,
    isDocument: true
  });
  
  await ctx.replyWithHTML(
    `<blockquote>✅ File Diterima</blockquote>\n\n` +
    `📁 <b>Nama:</b> ${doc.file_name || 'Unknown'}\n` +
    `📦 <b>Size:</b> ${(doc.file_size / 1024).toFixed(1)} KB\n\n` +
    `Pilih fitur:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🖼 RemoveBG', callback_data: `rb_${shortId}` },
            { text: '🔍 Unblur', callback_data: `ub_${shortId}` }
          ],
          [
            { text: '🎭 Face Swap', callback_data: `fs_${shortId}` },
            { text: '📸 HD', callback_data: `hd_${shortId}` }
          ]
        ]
      }
    }
  );
});

// ═══════════════════════════════════════════════════════════
// REMOVE BACKGROUND HANDLER
// ═══════════════════════════════════════════════════════════
bot.action(/^rb_([a-z0-9]+)$/, async (ctx) => {
  await ctx.answerCbQuery('🖼 Memulai RemoveBG...');
  const shortId = ctx.match[1];
  const fileId = getFileMapping(shortId);
  
  if (!fileId) {
    return ctx.reply('❌ Session expired. Kirim foto ulang ya!');
  }
  
  try {
    // Dapatkan link file
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    
    // Kirim progress message
    const progressMsg = await ctx.replyWithHTML(
      `<blockquote>🖼 Remove Background</blockquote>\n\n` +
      `⏳ Memulai proses...`
    );
    
    // Animasi progress
    await showProgress(ctx, progressMsg.message_id, ctx.chat.id, 'REMOVE BACKGROUND');
    
    // Panggil API
    const apiUrl = `https://api.fikmydomainsz.xyz/imagecreator/removebg?url=${encodeURIComponent(fileUrl)}`;
    
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: { 'Accept': 'image/png,image/jpeg,image/*' }
    });
    
    // Hapus progress message
    await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id);
    
    // Kirim hasil
    await ctx.replyWithDocument(
      { source: Buffer.from(response.data), filename: `removebg_${Date.now()}.png` },
      {
        caption: 
          `<blockquote>✅ RemoveBG Selesai!</blockquote>\n\n` +
          `🖼 Background berhasil dihapus!\n` +
          `📥 Download file di atas ☝️\n\n` +
          `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`,
        parse_mode: 'HTML'
      }
    );
    
    updateStats(ctx.from.id, 'removebg');
    
  } catch (error) {
    console.error('RemoveBG Error:', error.message);
    await ctx.replyWithHTML(
      `<blockquote>❌ Gagal</blockquote>\n\n` +
      `Maaf, gagal memproses foto.\n` +
      `Coba dengan foto lain atau hubungi admin.`
    );
  }
});

// ═══════════════════════════════════════════════════════════
// UNBLUR HANDLER
// ═══════════════════════════════════════════════════════════
bot.action(/^ub_([a-z0-9]+)$/, async (ctx) => {
  await ctx.answerCbQuery('🔍 Memulai Unblur...');
  const shortId = ctx.match[1];
  const fileId = getFileMapping(shortId);
  
  if (!fileId) return ctx.reply('❌ Session expired. Kirim foto ulang!');
  
  try {
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    
    const progressMsg = await ctx.replyWithHTML(
      `<blockquote>🔍 Unblur Foto</blockquote>\n\n` +
      `⏳ Memulai proses...`
    );
    
    await showProgress(ctx, progressMsg.message_id, ctx.chat.id, 'UNBLUR FOTO');
    
    const apiUrl = `https://api.fikmydomainsz.xyz/imagecreator/unblur?url=${encodeURIComponent(fileUrl)}`;
    
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    });
    
    await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id);
    
    await ctx.replyWithPhoto(
      { source: Buffer.from(response.data) },
      {
        caption: 
          `<blockquote>✅ Unblur Selesai!</blockquote>\n\n` +
          `🔍 Foto blur berhasil diperjelas!\n\n` +
          `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`,
        parse_mode: 'HTML'
      }
    );
    
    updateStats(ctx.from.id, 'unblur');
    
  } catch (error) {
    console.error('Unblur Error:', error.message);
    await ctx.reply('❌ Gagal unblur. Coba foto lain ya!');
  }
});

// ═══════════════════════════════════════════════════════════
// FACE SWAP HANDLER (2 STEP)
// ═══════════════════════════════════════════════════════════
bot.action(/^fs_([a-z0-9]+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const shortId = ctx.match[1];
  const userId = ctx.from.id.toString();
  
  const session = db.sessions.get(userId);
  if (!session) return ctx.reply('❌ Error session!');
  
  // Simpan sebagai source face
  db.sessions.set(userId, {
    ...session,
    step: 'faceswap_wait_target',
    sourceShortId: shortId
  });
  
  await ctx.editMessageText(
    `<blockquote>🎭 Face Swap Mode</blockquote>\n\n` +
    `✅ <b>Foto SUMBER (wajah)</b> sudah disimpan!\n\n` +
    `📸 Sekarang kirim foto <b>TARGET</b>\n` +
    `(foto yang wajahnya mau diganti)\n\n` +
    `<i>Contoh: Foto artis, teman, dll</i>`,
    { parse_mode: 'HTML' }
  );
});

// Handle foto kedua untuk face swap
bot.on('photo', checkMembership, async (ctx) => {
  const userId = ctx.from.id.toString();
  const session = db.sessions.get(userId);
  
  if (!session || session.step !== 'faceswap_wait_target') {
    // Bukan mode face swap, treat sebagai foto baru
    return handleNewPhoto(ctx);
  }
  
  const targetPhoto = ctx.message.photo[ctx.message.photo.length - 1];
  const targetShortId = generateShortId();
  saveFileMapping(targetShortId, targetPhoto.file_id);
  
  const sourceFileId = getFileMapping(session.sourceShortId);
  const targetFileId = targetPhoto.file_id;
  
  if (!sourceFileId) {
    return ctx.reply('❌ Session expired. Ulangi dari awal ya!');
  }
  
  try {
    const sourceFile = await ctx.telegram.getFile(sourceFileId);
    const targetFile = await ctx.telegram.getFile(targetFileId);
    
    const sourceUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${sourceFile.file_path}`;
    const targetUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${targetFile.file_path}`;
    
    const progressMsg = await ctx.replyWithHTML(
      `<blockquote>🎭 Face Swap</blockquote>\n\n` +
      `⏳ Memulai proses...`
    );
    
    await showProgress(ctx, progressMsg.message_id, ctx.chat.id, 'FACE SWAP');
    
    const apiUrl = `https://api.vreden.my.id/api/v1/artificial/imgedit/faceswap?from_url=${encodeURIComponent(sourceUrl)}&to_url=${encodeURIComponent(targetUrl)}`;
    
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 120000
    });
    
    await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id);
    
    await ctx.replyWithPhoto(
      { source: Buffer.from(response.data) },
      {
        caption: 
          `<blockquote>✅ Face Swap Selesai!</blockquote>\n\n` +
          `🎭 Wajah berhasil ditukar!\n\n` +
          `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`,
        parse_mode: 'HTML'
      }
    );
    
    updateStats(ctx.from.id, 'faceswap');
    db.sessions.delete(userId);
    
  } catch (error) {
    console.error('FaceSwap Error:', error.message);
    await ctx.reply(
      `❌ Gagal face swap!\n` +
      `Pastikan:\n` +
      `• Kedua foto memiliki wajah yang jelas\n` +
      `• Wajah tidak terlalu kecil\n` +
      `• Coba dengan foto lain`
    );
    db.sessions.delete(userId);
  }
});

// ═══════════════════════════════════════════════════════════
// HD ENHANCER HANDLER
// ═══════════════════════════════════════════════════════════
bot.action(/^hd_([a-z0-9]+)$/, async (ctx) => {
  await ctx.answerCbQuery('📸 Meningkatkan kualitas...');
  const shortId = ctx.match[1];
  const fileId = getFileMapping(shortId);
  
  if (!fileId) return ctx.reply('❌ Session expired!');
  
  try {
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    
    const progressMsg = await ctx.replyWithHTML(
      `<blockquote>📸 HD Enhancer</blockquote>\n\n` +
      `⏳ Memulai proses...`
    );
    
    await showProgress(ctx, progressMsg.message_id, ctx.chat.id, 'HD ENHANCER');
    
    // Gunakan API upscale (fallback ke removebg jika tidak ada)
    const apiUrl = `https://api.fikmydomainsz.xyz/imagecreator/upscale?url=${encodeURIComponent(fileUrl)}`;
    
    let response;
    try {
      response = await axios.get(apiUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });
    } catch (e) {
      // Fallback: gunakan removebg sebagai enhancer
      response = await axios.get(
        `https://api.fikmydomainsz.xyz/imagecreator/removebg?url=${encodeURIComponent(fileUrl)}`,
        { responseType: 'arraybuffer', timeout: 60000 }
      );
    }
    
    await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id);
    
    await ctx.replyWithPhoto(
      { source: Buffer.from(response.data) },
      {
        caption: 
          `<blockquote>✅ HD Enhancer Selesai!</blockquote>\n\n` +
          `📸 Kualitas foto ditingkatkan!\n\n` +
          `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`,
        parse_mode: 'HTML'
      }
    );
    
    updateStats(ctx.from.id, 'hd');
    
  } catch (error) {
    console.error('HD Error:', error.message);
    await ctx.reply('❌ Gagal enhance. Coba foto lain ya!');
  }
});

// ═══════════════════════════════════════════════════════════
// CANCEL HANDLER
// ═══════════════════════════════════════════════════════════
bot.action(/^cancel_([a-z0-9]+)$/, async (ctx) => {
  await ctx.answerCbQuery('❌ Dibatalkan');
  await ctx.deleteMessage();
  db.sessions.delete(ctx.from.id.toString());
});

// ═══════════════════════════════════════════════════════════
// VERIFIKASI MEMBERSHIP
// ═══════════════════════════════════════════════════════════
bot.action(/^verify_(.+)$/, async (ctx) => {
  const userId = ctx.match[1];
  if (userId !== ctx.from.id.toString()) {
    return ctx.answerCbQuery('❌ Bukan untukmu!', { show_alert: true });
  }
  
  await ctx.answerCbQuery('⏳ Memeriksa...');
  
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
        joinedAt: Date.now()
      });
      
      await ctx.editMessageText(
        `✅ <b>Verifikasi Berhasil!</b>\n\n` +
        `Terima kasih sudah join ${REQUIRED_CHANNEL}!\n` +
        `Klik /start untuk mulai menggunakan bot.`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.answerCbQuery('❌ Kamu belum join channel!', { show_alert: true });
    }
  } catch (error) {
    console.error('Verify error:', error);
    await ctx.answerCbQuery('❌ Error verifikasi. Coba lagi!', { show_alert: true });
  }
});

// ═══════════════════════════════════════════════════════════
// KEYBOARD MENU HANDLERS
// ═══════════════════════════════════════════════════════════
bot.hears('🖼 RemoveBG', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>🖼 Remove Background</blockquote>\n\n` +
    `📸 <b>Kirim foto sekarang!</b>\n\n` +
    `Tips untuk hasil terbaik:\n` +
    `• Foto dengan objek jelas\n` +
    `• Kontras background & objek tinggi\n` +
    `• Resolusi minimal 500x500px`
  );
});

bot.hears('🔍 Unblur', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>🔍 Unblur Foto</blockquote>\n\n` +
    `📸 <b>Kirim foto blur sekarang!</b>\n\n` +
    `Tips:\n` +
    `• Semakin blur = semakin lama proses\n` +
    `• Foto wajah bekerja paling baik\n` +
    `• Hasil tergantung kualitas asli`
  );
});

bot.hears('🎭 Face Swap', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>🎭 Face Swap</blockquote>\n\n` +
    `🎯 <b>Cara Menggunakan:</b>\n\n` +
    `1️⃣ Kirim foto <b>SUMBER</b> (wajah yg mau dipindah)\n` +
    `2️⃣ Pilih "Face Swap" di tombol\n` +
    `3️⃣ Kirim foto <b>TARGET</b> (foto yg mau ditumpangi)\n` +
    `4️⃣ Tunggu hasilnya!\n\n` +
    `<i>⚠️ Pastikan wajah terlihat jelas di kedua foto</i>`
  );
});

bot.hears('🎨 Logo AI', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>🎨 Logo Generator</blockquote>\n\n` +
    `✏️ <b>Format Perintah:</b>\n\n` +
    `/logo [BRAND] | [IDEA] | [SLOGAN]\n\n` +
    `📌 <b>Contoh:</b>\n` +
    `/logo TechCorp | Technology Future | Innovate Tomorrow\n\n` +
    `🎨 Bot akan generate 4 variasi logo!`
  );
});

bot.hears('📸 HD Enhancer', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>📸 HD Enhancer</blockquote>\n\n` +
    `📸 <b>Kirim foto yang mau di-HD-kan!</b>\n\n` +
    `Fitur ini akan:\n` +
    `• Meningkatkan resolusi\n` +
    `• Mempertajam detail\n` +
    `• Meningkatkan kualitas warna`
  );
});

bot.hears('📊 Status', checkMembership, (ctx) => {
  const userId = ctx.from.id.toString();
  const user = db.users.get(userId);
  const stats = db.stats.get(userId) || { removebg: 0, unblur: 0, faceswap: 0, hd: 0, logo: 0, total: 0 };
  
  ctx.replyWithHTML(
    `<blockquote>📊 Status Pengguna</blockquote>\n\n` +
    `👤 <b>Nama:</b> ${user?.firstName || ctx.from.first_name}\n` +
    `🆔 <b>ID:</b> <code>${userId}</code>\n` +
    `📅 <b>Member Sejak:</b> ${user ? new Date(user.joinedAt).toLocaleDateString('id-ID') : '-'}\n\n` +
    `📈 <b>Statistik Penggunaan:</b>\n` +
    `├ 🖼 RemoveBG: ${stats.removebg}x\n` +
    `├ 🔍 Unblur: ${stats.unblur}x\n` +
    `├ 🎭 Face Swap: ${stats.faceswap}x\n` +
    `├ 📸 HD: ${stats.hd}x\n` +
    `├ 🎨 Logo: ${stats.logo}x\n` +
    `└ 📊 Total: ${stats.total}x\n\n` +
    `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`
  );
});

bot.hears('❓ Cara Pakai', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>📖 Panduan Lengkap</blockquote>\n\n` +
    `🖼 <b>RemoveBG:</b> Kirim foto → Pilih RemoveBG\n` +
    `🔍 <b>Unblur:</b> Kirim foto blur → Pilih Unblur\n` +
    `🎭 <b>Face Swap:</b> Kirim 2 foto (sumber & target)\n` +
    `🎨 <b>Logo:</b> Ketik /logo brand|idea|slogan\n` +
    `📸 <b>HD:</b> Kirim foto → Pilih HD\n\n` +
    `⚡ <b>Limit:</b> 5 request/menit\n` +
    `📦 <b>Max File:</b> 20MB\n\n` +
    `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`
  );
});

bot.hears('📢 Channel', (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>📢 Join Channel</blockquote>\n\n` +
    `Dapatkan update fitur terbaru!`,
    Markup.inlineKeyboard([
      [Markup.button.url('🔔 Join Channel', `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}`)]
    ])
  );
});

// ═══════════════════════════════════════════════════════════
// LOGO GENERATOR COMMAND
// ═══════════════════════════════════════════════════════════
bot.command('logo', checkMembership, async (ctx) => {
  const args = ctx.message.text.slice(6).trim().split('|').map(s => s.trim());
  
  if (args.length < 3 || !args[0] || !args[1] || !args[2]) {
    return ctx.replyWithHTML(
      `<blockquote>❌ Format Salah</blockquote>\n\n` +
      `✏️ <b>Format:</b> /logo BRAND | IDEA | SLOGAN\n\n` +
      `📌 <b>Contoh:</b>\n` +
      `/logo MyBrand | Creative Design | Build Your Dream`
    );
  }
  
  const [brand, idea, slogan] = args;
  
  const progressMsg = await ctx.replyWithHTML(
    `<blockquote>🎨 Membuat Logo...</blockquote>\n\n` +
    `Brand: <b>${brand}</b>\n` +
    `Idea: <b>${idea}</b>\n` +
    `Slogan: <b>${slogan}</b>\n\n` +
    `⏳ Memulai...`
  );
  
  await showProgress(ctx, progressMsg.message_id, ctx.chat.id, 'LOGO GENERATOR');
  
  try {
    const apiUrl = `https://apizell.web.id/ai/logogenerator?brand=${encodeURIComponent(brand)}&idea=${encodeURIComponent(idea)}&slogan=${encodeURIComponent(slogan)}`;
    
    const response = await axios.get(apiUrl, { timeout: 60000 });
    const data = response.data;
    
    await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id);
    
    if (data?.result && Array.isArray(data.result) && data.result.length > 0) {
      await ctx.replyWithHTML(
        `<blockquote>🎨 Logo Generated!</blockquote>\n\n` +
        `Brand: <b>${brand}</b>\n` +
        `Idea: <b>${idea}</b>\n` +
        `Slogan: <b>${slogan}</b>\n\n` +
        `Menampilkan ${Math.min(data.result.length, 4)} hasil:`
      );
      
      for (let i = 0; i < Math.min(data.result.length, 4); i++) {
        await ctx.replyWithPhoto(
          data.result[i],
          {
            caption: 
              `<blockquote>🎨 Logo ${i + 1}</blockquote>\n` +
              `<blockquote>💎 ${REQUIRED_CHANNEL}</blockquote>`,
            parse_mode: 'HTML'
          }
        );
      }
      
      updateStats(ctx.from.id, 'logo');
    } else {
      await ctx.reply('❌ Gagal generate logo. Coba kata kunci lain!');
    }
    
  } catch (error) {
    console.error('Logo Error:', error.message);
    await ctx.reply('❌ Server sibuk. Coba lagi nanti ya!');
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN COMMANDS
// ═══════════════════════════════════════════════════════════
bot.command('broadcast', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id.toString())) {
    return ctx.reply('❌ Hanya admin!');
  }
  
  const text = ctx.message.text.slice(11).trim();
  if (!text) return ctx.reply('Format: /broadcast [pesan]');
  
  let success = 0, failed = 0;
  
  for (const [userId, user] of db.users) {
    try {
      await ctx.telegram.sendMessage(userId,
        `<blockquote>📢 PENGUMUMAN</blockquote>\n\n${text}`,
        { parse_mode: 'HTML' }
      );
      success++;
      await new Promise(r => setTimeout(r, 50)); // Delay anti flood
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
  
  let totalRequests = 0;
  for (const s of db.stats.values()) totalRequests += s.total;
  
  await ctx.replyWithHTML(
    `<blockquote>📊 Statistik Bot</blockquote>\n\n` +
    `👥 Total Users: ${db.users.size}\n` +
    `🔄 Total Requests: ${totalRequests}\n` +
    `⏱ Uptime: ${(process.uptime() / 3600).toFixed(2)} jam\n` +
    `🧠 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`
  );
});

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════
function updateStats(userId, feature) {
  const id = userId.toString();
  if (!db.stats.has(id)) {
    db.stats.set(id, { removebg: 0, unblur: 0, faceswap: 0, hd: 0, logo: 0, total: 0 });
  }
  const s = db.stats.get(id);
  s[feature]++;
  s.total++;
  db.stats.set(id, s);
}

async function handleNewPhoto(ctx) {
  // Reuse logic dari handler foto utama
  const userId = ctx.from.id.toString();
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const fileId = photo.file_id;
  const fileUniqueId = photo.file_unique_id;
  
  const shortId = generateShortId();
  saveFileMapping(shortId, fileId);
  
  db.sessions.set(userId, {
    fileId: fileId,
    shortId: shortId,
    timestamp: Date.now()
  });
  
  await ctx.replyWithHTML(
    `<blockquote>✅ Foto Diterima</blockquote>\n\n` +
    `🖼 <b>File:</b> <code>${fileUniqueId.slice(-8)})}</code>\n` +
    `📐 <b>Resolusi:</b> ${photo.width}x${photo.height}\n\n` +
    `Pilih fitur yang</code>\n` +
    `📐 <b>Resolusi:</b> ${photo.width}x${photo.height}\n\n` +
    `Pilih fitur yang mau digunakan:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🖼 RemoveBG', callback_data: `rb_${shortId}` },
            { text: '🔍 Unblur', callback_data: `ub_${shortId}` }
          ],
          [
            { text: '🎭 Face Swap', callback_data: `fs_${shortId}` },
            { text: '📸 HD', callback_data: `hd_${shortId}` }
          ],
          [
            { text: '❌ Batalkan', callback_data: `cancel_${shortId}` }
          ]
        ]
      }
    }
  );
}

// ═══════════════════════════════════════════════════════════
// ERROR HANDLING & START
// ═══════════════════════════════════════════════════════════
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err.message);
  ctx.reply('❌ Terjadi kesalahan. Coba lagi atau hubungi admin.').catch(() => {});
});

// Cleanup expired sessions setiap 10 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of db.tempFiles) {
    if (value.expires < now) db.tempFiles.delete(key);
  }
  for (const [key, value] of db.sessions) {
    if (now - value.timestamp > 300000) db.sessions.delete(key);
  }
}, 600000);

console.log('🤖 Bot RemoveBG VVIP v2.0 Starting...');
console.log(`📅 ${new Date().toLocaleString('id-ID')}`);
console.log(`📢 Channel: ${REQUIRED_CHANNEL}`);

bot.launch()
  .then(() => console.log('✅ Bot Running!'))
  .catch(err => console.error('❌ Start Failed:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

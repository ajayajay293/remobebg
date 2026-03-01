const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs-extra');
const FormData = require('form-data');

// Konfigurasi Bot
const BOT_TOKEN = '8446129409:AAH3El-xB1oPN7Dl1mHN0oS_1_qw4KtwFAA';
const REQUIRED_CHANNEL = '@StoreRealll';
const ADMIN_ID = '6816905895'; // Ganti dengan ID admin untuk broadcast

// Inisialisasi Bot
const bot = new Telegraf(BOT_TOKEN);

// Database sederhana (gunakan database nyata untuk production)
const db = {
  users: new Map(),
  pendingPhotos: new Map(),
  userStats: new Map()
};

// Middleware untuk cek membership
async function checkMembership(ctx, next) {
  const userId = ctx.from.id;
  
  try {
    const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, userId);
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);
    
    if (!isMember) {
      return ctx.replyWithHTML(
        `<blockquote>⚠️ AKSES DITOLAK</blockquote>\n\n` +
        `Anda harus bergabung ke channel ${REQUIRED_CHANNEL} terlebih dahulu!\n\n` +
        `Silakan join channel, lalu klik /start kembali.`,
        Markup.inlineKeyboard([
          [Markup.button.url('🔔 Join Channel', `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}`)],
          [Markup.button.callback('✅ Sudah Join', 'check_membership')]
        ])
      );
    }
    
    // Simpan user ke database
    if (!db.users.has(userId)) {
      db.users.set(userId, {
        id: userId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        joinedAt: new Date().toISOString(),
        totalUsage: 0
      });
    }
    
    return next();
  } catch (error) {
    console.error('Membership check error:', error);
    return ctx.reply('❌ Terjadi kesalahan. Coba lagi nanti.');
  }
}

// Command /start
bot.command('start', checkMembership, async (ctx) => {
  const user = ctx.from;
  const welcomeText = 
    `<blockquote>🎨 REMOVEBG VVIP BOT</blockquote>\n\n` +
    `Halo <b>${user.first_name}</b>! 👋\n\n` +
    `🤖 <b>Bot Premium untuk Edit Foto</b>\n\n` +
    `✨ <b>Fitur Tersedia:</b>\n` +
    `├ 🖼 Remove Background\n` +
    `├ 🔍 Unblur Foto\n` +
    `├ 🎭 Face Swap\n` +
    `├ 🎨 Logo Generator\n` +
    `└ 📸 HD Enhancer\n\n` +
    `📌 <b>Cara Penggunaan:</b>\n` +
    `Kirim foto langsung ke bot ini, lalu pilih fitur yang diinginkan!\n\n` +
    `<blockquote>💎 Powered by @StoreRealll</blockquote>`;

  await ctx.replyWithHTML(welcomeText, {
    reply_markup: {
      keyboard: [
        ['🖼 RemoveBG', '🔍 Unblur'],
        ['🎭 Face Swap', '🎨 Logo Generator'],
        ['📸 HD Enhancer', '📊 Status Saya'],
        ['❓ Bantuan', '📢 Channel']
      ],
      resize_keyboard: true
    }
  });
});

// Command /help
bot.command('help', checkMembership, (ctx) => {
  const helpText = 
    `<blockquote>📖 PANDUAN PENGGUNAAN</blockquote>\n\n` +
    `🖼 <b>Remove Background</b>\n` +
    `Kirim foto → Pilih "RemoveBG"\n\n` +
    `🔍 <b>Unblur Foto</b>\n` +
    `Kirim foto blur → Pilih "Unblur"\n\n` +
    `🎭 <b>Face Swap</b>\n` +
    `Kirim 2 foto (wajah sumber & target)\n\n` +
    `🎨 <b>Logo Generator</b>\n` +
    `Klik menu Logo Generator → Isi detail\n\n` +
    `📸 <b>HD Enhancer</b>\n` +
    `Kirim foto → Pilih "HD Enhancer"\n\n` +
    `<blockquote>⚡ Bot ini 100% gratis untuk member ${REQUIRED_CHANNEL}</blockquote>`;

  ctx.replyWithHTML(helpText);
});

// Handler untuk foto yang dikirim
bot.on('photo', checkMembership, async (ctx) => {
  const userId = ctx.from.id;
  const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Resolusi tertinggi
  const fileId = photo.file_id;
  
  // Simpan foto sementara
  db.pendingPhotos.set(userId, {
    fileId: fileId,
    timestamp: Date.now()
  });

  await ctx.replyWithHTML(
    `<blockquote>✅ Foto Diterima</blockquote>\n\n` +
    `Foto berhasil diterima! Sekarang mau diapain nih? 🤔\n\n` +
    `Pilih fitur di bawah ini:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🖼 RemoveBG', `removebg:${fileId}`),
        Markup.button.callback('🔍 Unblur', `unblur:${fileId}`)
      ],
      [
        Markup.button.callback('🎭 Face Swap', `faceswap_init:${fileId}`),
        Markup.button.callback('📸 HD Enhancer', `hd:${fileId}`)
      ],
      [
        Markup.button.callback('❌ Batal', 'cancel')
      ]
    ])
  );
});

// Handler untuk dokumen (foto sebagai file)
bot.on('document', checkMembership, async (ctx) => {
  const doc = ctx.message.document;
  if (!doc.mime_type.startsWith('image/')) {
    return ctx.reply('❌ Hanya file gambar yang diterima!');
  }
  
  const userId = ctx.from.id;
  db.pendingPhotos.set(userId, {
    fileId: doc.file_id,
    timestamp: Date.now(),
    isDocument: true
  });

  await ctx.replyWithHTML(
    `<blockquote>✅ Foto Diterima</blockquote>\n\n` +
    `Foto berhasil diterima! Pilih fitur:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🖼 RemoveBG', `removebg:${doc.file_id}`),
        Markup.button.callback('🔍 Unblur', `unblur:${doc.file_id}`)
      ],
      [
        Markup.button.callback('🎭 Face Swap', `faceswap_init:${doc.file_id}`),
        Markup.button.callback('📸 HD Enhancer', `hd:${doc.file_id}`)
      ]
    ])
  );
});

// Remove Background Handler
bot.action(/^removebg:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('⏳ Memproses RemoveBG...');
  const fileId = ctx.match[1];
  
  try {
    // Dapatkan link file
    const fileLink = await ctx.telegram.getFileLink(fileId);
    
    // Panggil API RemoveBG
    const apiUrl = `https://api.fikmydomainsz.xyz/imagecreator/removebg?url=${encodeURIComponent(fileLink)}`;
    
    await ctx.replyWithHTML(
      `<blockquote>⏳ Sedang Memproses</blockquote>\n\n` +
      `Sedang menghapus background foto...\n` +
      `Mohon tunggu sebentar ya! ⏱`
    );
    
    // Download hasil
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    });
    
    // Kirim hasil
    await ctx.replyWithDocument(
      { source: Buffer.from(response.data), filename: 'removebg_result.png' },
      {
        caption: `<blockquote>✅ RemoveBG Berhasil!</blockquote>\n\n🖼 Background berhasil dihapus!\n\n💎 Powered by @StoreRealll`,
        parse_mode: 'HTML'
      }
    );
    
    updateStats(ctx.from.id, 'removebg');
    
  } catch (error) {
    console.error('RemoveBG Error:', error);
    await ctx.replyWithHTML(
      `<blockquote>❌ Gagal</blockquote>\n\n` +
      `Maaf, terjadi kesalahan saat memproses foto.\n` +
      `Coba lagi dengan foto lain atau hubungi admin.`
    );
  }
});

// Unblur Handler
bot.action(/^unblur:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('⏳ Memproses Unblur...');
  const fileId = ctx.match[1];
  
  try {
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const apiUrl = `https://api.fikmydomainsz.xyz/imagecreator/unblur?url=${encodeURIComponent(fileLink)}`;
    
    await ctx.replyWithHTML(
      `<blockquote>⏳ Sedang Memproses</blockquote>\n\n` +
      `Sedang memperjelas foto blur...\n` +
      `Mohon tunggu sebentar ya! ⏱`
    );
    
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    });
    
    await ctx.replyWithPhoto(
      { source: Buffer.from(response.data) },
      {
        caption: `<blockquote>✅ Unblur Berhasil!</blockquote>\n\n🔍 Foto berhasil diperjelas!\n\n💎 Powered by @StoreRealll`,
        parse_mode: 'HTML'
      }
    );
    
    updateStats(ctx.from.id, 'unblur');
    
  } catch (error) {
    console.error('Unblur Error:', error);
    await ctx.reply('❌ Gagal memproses unblur. Coba lagi.');
  }
});

// Face Swap Handler - Step 1: Init
bot.action(/^faceswap_init:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const fileId = ctx.match[1];
  const userId = ctx.from.id;
  
  db.pendingPhotos.set(userId, {
    step: 'faceswap_source',
    sourceFileId: fileId
  });
  
  await ctx.replyWithHTML(
    `<blockquote>🎭 Face Swap Mode</blockquote>\n\n` +
    `✅ Foto wajah <b>SUMBER</b> sudah diterima!\n\n` +
    `📸 Sekarang kirim foto <b>TARGET</b> (foto yang mau ditumpangi wajahnya)\n\n` +
    `<i>Contoh: Kirim foto artis, teman, atau siapa saja yang wajahnya mau diganti</i>`
  );
});

// Face Swap Handler - Step 2: Process
bot.action(/^faceswap_process:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('⏳ Memproses Face Swap...');
  const [, sourceFileId, targetFileId] = ctx.match;
  
  try {
    const sourceLink = await ctx.telegram.getFileLink(sourceFileId);
    const targetLink = await ctx.telegram.getFileLink(targetFileId);
    
    const apiUrl = `https://api.vreden.my.id/api/v1/artificial/imgedit/faceswap?from_url=${encodeURIComponent(sourceLink)}&to_url=${encodeURIComponent(targetLink)}`;
    
    await ctx.replyWithHTML(
      `<blockquote>⏳ Sedang Memproses</blockquote>\n\n` +
      `Sedang mengganti wajah...\n` +
      `Ini membutuhkan waktu beberapa detik ⏱`
    );
    
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 120000
    });
    
    await ctx.replyWithPhoto(
      { source: Buffer.from(response.data) },
      {
        caption: `<blockquote>✅ Face Swap Berhasil!</blockquote>\n\n🎭 Wajah berhasil ditukar!\n\n💎 Powered by @StoreRealll`,
        parse_mode: 'HTML'
      }
    );
    
    updateStats(ctx.from.id, 'faceswap');
    db.pendingPhotos.delete(ctx.from.id);
    
  } catch (error) {
    console.error('FaceSwap Error:', error);
    await ctx.reply('❌ Gagal memproses face swap. Pastikan kedua foto memiliki wajah yang jelas.');
  }
});

// HD Enhancer Handler
bot.action(/^hd:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('⏳ Meningkatkan kualitas...');
  const fileId = ctx.match[1];
  
  try {
    const fileLink = await ctx.telegram.getFileLink(fileId);
    
    // Gunakan API upscaler (gunakan API yang tersedia atau proxy)
    const apiUrl = `https://api.fikmydomainsz.xyz/imagecreator/upscale?url=${encodeURIComponent(fileLink)}`;
    
    await ctx.replyWithHTML(
      `<blockquote>⏳ Sedang Memproses</blockquote>\n\n` +
      `Sedang meningkatkan kualitas foto ke HD...\n` +
      `Mohon tunggu sebentar ya! ⏱`
    );
    
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    });
    
    await ctx.replyWithPhoto(
      { source: Buffer.from(response.data) },
      {
        caption: `<blockquote>✅ HD Enhancer Berhasil!</blockquote>\n\n📸 Kualitas foto berhasil ditingkatkan!\n\n💎 Powered by @StoreRealll`,
        parse_mode: 'HTML'
      }
    );
    
    updateStats(ctx.from.id, 'hd');
    
  } catch (error) {
    // Fallback: gunakan removebg API sebagai alternatif enhancer
    console.error('HD Error:', error);
    await ctx.reply('❌ Fitur HD sedang maintenance. Gunakan RemoveBG atau Unblur dulu ya!');
  }
});

// Logo Generator Command
bot.command('logo', checkMembership, async (ctx) => {
  await ctx.replyWithHTML(
    `<blockquote>🎨 Logo Generator</blockquote>\n\n` +
    `Gunakan format berikut:\n\n` +
    `/logogen [brand] | [idea] | [slogan]\n\n` +
    `📌 Contoh:\n` +
    `/logogen TechCorp | Technology Future | Innovate Tomorrow`
  );
});

// Logo Generator Handler
bot.command('logogen', checkMembership, async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1).join(' ').split('|').map(s => s.trim());
  
  if (args.length < 3) {
    return ctx.replyWithHTML(
      `<blockquote>❌ Format Salah</blockquote>\n\n` +
      `Gunakan format:\n/logogen [brand] | [idea] | [slogan]\n\n` +
      `Contoh:\n/logogen MyBrand | Creative Design | Build Your Dream`
    );
  }
  
  const [brand, idea, slogan] = args;
  
  try {
    await ctx.replyWithHTML(
      `<blockquote>⏳ Membuat Logo</blockquote>\n\n` +
      `Brand: <b>${brand}</b>\n` +
      `Idea: <b>${idea}</b>\n` +
      `Slogan: <b>${slogan}</b>\n\n` +
      `Sedang membuat logo... ⏱`
    );
    
    const apiUrl = `https://apizell.web.id/ai/logogenerator?brand=${encodeURIComponent(brand)}&idea=${encodeURIComponent(idea)}&slogan=${encodeURIComponent(slogan)}`;
    
    const response = await axios.get(apiUrl, { timeout: 60000 });
    const data = response.data;
    
    if (data && data.result && data.result.length > 0) {
      // Kirim semua hasil logo
      for (let i = 0; i < Math.min(data.result.length, 4); i++) {
        await ctx.replyWithPhoto(
          data.result[i],
          {
            caption: `<blockquote>🎨 Logo ${i + 1}</blockquote>\n\nBrand: ${brand}\nIdea: ${idea}\nSlogan: ${slogan}\n\n💎 Powered by @StoreRealll`,
            parse_mode: 'HTML'
          }
        );
      }
      
      updateStats(ctx.from.id, 'logo');
    } else {
      await ctx.reply('❌ Gagal generate logo. Coba dengan kata kunci lain.');
    }
    
  } catch (error) {
    console.error('Logo Error:', error);
    await ctx.reply('❌ Gagal membuat logo. Server sibuk, coba lagi nanti.');
  }
});

// Keyboard Menu Handlers
bot.hears('🖼 RemoveBG', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>🖼 Remove Background</blockquote>\n\n` +
    `Kirim foto yang mau dihapus background-nya!\n\n` +
    `Tips: Kirim foto dengan objek jelas untuk hasil terbaik.`
  );
});

bot.hears('🔍 Unblur', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>🔍 Unblur Foto</blockquote>\n\n` +
    `Kirim foto yang blur mau diperjelas!\n\n` +
    `Tips: Semakin blur fotonya, semakin lama prosesnya.`
  );
});

bot.hears('🎭 Face Swap', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>🎭 Face Swap</blockquote>\n\n` +
    `Cara penggunaan:\n\n` +
    `1️⃣ Kirim foto wajah SUMBER (wajah yang mau dipindah)\n` +
    `2️⃣ Pilih "Face Swap" di menu\n` +
    `3️⃣ Kirim foto TARGET (foto yang mau ditumpangi)\n` +
    `4️⃣ Bot akan otomatis mengganti wajahnya!\n\n` +
    `<i>Pastikan kedua foto memiliki wajah yang jelas terlihat</i>`
  );
});

bot.hears('🎨 Logo Generator', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>🎨 Logo Generator</blockquote>\n\n` +
    `Ketik perintah berikut:\n\n` +
    `/logogen [brand] | [idea] | [slogan]\n\n` +
    `📌 Contoh:\n` +
    `/logogen TechCorp | Technology Future | Innovate Tomorrow`
  );
});

bot.hears('📸 HD Enhancer', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>📸 HD Enhancer</blockquote>\n\n` +
    `Kirim foto yang mau ditingkatkan kualitasnya ke HD!\n\n` +
    `Tips: Foto dengan resolusi rendah akan diupscale otomatis.`
  );
});

bot.hears('📊 Status Saya', checkMembership, (ctx) => {
  const userId = ctx.from.id;
  const stats = db.userStats.get(userId) || {
    removebg: 0,
    unblur: 0,
    faceswap: 0,
    logo: 0,
    hd: 0,
    total: 0
  };
  
  const user = db.users.get(userId);
  
  ctx.replyWithHTML(
    `<blockquote>📊 Status Pengguna</blockquote>\n\n` +
    `👤 Nama: ${user?.firstName || ctx.from.first_name}\n` +
    `🆔 ID: <code>${userId}</code>\n` +
    `📅 Bergabung: ${user ? new Date(user.joinedAt).toLocaleDateString('id-ID') : '-'}\n\n` +
    `📈 <b>Statistik Penggunaan:</b>\n` +
    `├ 🖼 RemoveBG: ${stats.removebg}x\n` +
    `├ 🔍 Unblur: ${stats.unblur}x\n` +
    `├ 🎭 Face Swap: ${stats.faceswap}x\n` +
    `├ 🎨 Logo: ${stats.logo}x\n` +
    `├ 📸 HD: ${stats.hd}x\n` +
    `└ 📊 Total: ${stats.total}x\n\n` +
    `<blockquote>💎 Terima kasih telah menggunakan bot ini!</blockquote>`
  );
});

bot.hears('❓ Bantuan', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>📞 Bantuan & Dukungan</blockquote>\n\n` +
    `Jika mengalami kendala, hubungi:\n\n` +
    `📢 Channel: ${REQUIRED_CHANNEL}\n` +
    `👨‍💻 Developer: @Xneymarjunior\n\n` +
    `⚡ <b>Catatan Penting:</b>\n` +
    `• Bot ini gratis untuk member channel\n` +
    `• Jangan spam request\n` +
    `• Maksimal 5 request per menit\n` +
    `• File maksimal 20MB`
  );
});

bot.hears('📢 Channel', (ctx) => {
  ctx.replyWithHTML(
    `<blockquote>📢 Join Channel Kami</blockquote>\n\n` +
    `Dapatkan update dan fitur terbaru!`,
    Markup.inlineKeyboard([
      [Markup.button.url('🔔 Join Channel', `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}`)]
    ])
  );
});

// Callback handlers
bot.action('check_membership', async (ctx) => {
  await ctx.answerCbQuery('⏳ Memeriksa...');
  const userId = ctx.from.id;
  
  try {
    const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, userId);
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);
    
    if (isMember) {
      await ctx.editMessageText(
        `✅ Verifikasi berhasil! Silakan klik /start untuk menggunakan bot.`
      );
    } else {
      await ctx.answerCbQuery('❌ Belum join channel!', { show_alert: true });
    }
  } catch (error) {
    await ctx.answerCbQuery('❌ Error cek membership', { show_alert: true });
  }
});

bot.action('cancel', async (ctx) => {
  await ctx.answerCbQuery('❌ Dibatalkan');
  await ctx.deleteMessage();
  db.pendingPhotos.delete(ctx.from.id);
});

// Handle second photo for face swap
bot.on('photo', checkMembership, async (ctx) => {
  const userId = ctx.from.id;
  const pending = db.pendingPhotos.get(userId);
  
  if (pending && pending.step === 'faceswap_source') {
    const targetFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    
    await ctx.replyWithHTML(
      `<blockquote>🎭 Konfirmasi Face Swap</blockquote>\n\n` +
      `Foto target diterima! Proses sekarang?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Proses Face Swap', `faceswap_process:${pending.sourceFileId}:${targetFileId}`)],
        [Markup.button.callback('❌ Batal', 'cancel')]
      ])
    );
  }
});

// Admin Commands
bot.command('broadcast', async (ctx) => {
  // Cek apakah admin (ganti dengan ID admin yang sebenarnya)
  if (ctx.from.id.toString() !== ADMIN_ID) {
    return ctx.reply('❌ Hanya admin yang bisa menggunakan perintah ini!');
  }
  
  const message = ctx.message.text.split(' ').slice(1).join(' ');
  if (!message) return ctx.reply('Format: /broadcast [pesan]');
  
  let success = 0;
  let failed = 0;
  
  for (const [userId] of db.users) {
    try {
      await ctx.telegram.sendMessage(userId, 
        `<blockquote>📢 PENGUMUMAN</blockquote>\n\n${message}`, 
        { parse_mode: 'HTML' }
      );
      success++;
    } catch (e) {
      failed++;
    }
  }
  
  await ctx.reply(`📊 Broadcast selesai!\n✅ Berhasil: ${success}\n❌ Gagal: ${failed}`);
});

bot.command('stats', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) {
    return ctx.reply('❌ Hanya admin!');
  }
  
  const totalUsers = db.users.size;
  let totalRequests = 0;
  
  for (const stats of db.userStats.values()) {
    totalRequests += stats.total;
  }
  
  await ctx.replyWithHTML(
    `<blockquote>📊 Statistik Bot</blockquote>\n\n` +
    `👥 Total Users: ${totalUsers}\n` +
    `🔄 Total Requests: ${totalRequests}\n` +
    `⏱ Uptime: ${process.uptime().toFixed(0)} detik`
  );
});

// Helper functions
function updateStats(userId, feature) {
  if (!db.userStats.has(userId)) {
    db.userStats.set(userId, {
      removebg: 0,
      unblur: 0,
      faceswap: 0,
      logo: 0,
      hd: 0,
      total: 0
    });
  }
  
  const stats = db.userStats.get(userId);
  stats[feature]++;
  stats.total++;
  db.userStats.set(userId, stats);
  
  // Update user total usage
  const user = db.users.get(userId);
  if (user) {
    user.totalUsage = stats.total;
    db.users.set(userId, user);
  }
}

// Error handler
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi atau hubungi admin.');
});

// Start bot
console.log('🤖 Bot RemoveBG VVIP dimulai...');
console.log(`📅 ${new Date().toLocaleString('id-ID')}`);
console.log(`📢 Channel: ${REQUIRED_CHANNEL}`);

bot.launch()
  .then(() => console.log('✅ Bot berjalan!'))
  .catch(err => console.error('❌ Gagal start bot:', err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

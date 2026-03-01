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
// PROGRESS STEPS (Optimized for API speed)
// ═══════════════════════════════════════════════════════════════════════════════
const PROCESS_STEPS = [
  { percent: 5, text: 'Detecting faces in both photos...', icon: '👤', delay: 1500 },
  { percent: 15, text: 'Downloading photos from Telegram...', icon: '⬇️', delay: 2000 },
  { percent: 25, text: 'Sending data to AI Engine...', icon: '📡', delay: 2500 },
  { percent: 35, text: 'AI analyzing source face features...', icon: '🤖', delay: 4000 },
  { percent: 48, text: 'Mapping face landmarks to target...', icon: '🗺️', delay: 5000 },
  { percent: 62, text: 'Performing face swap process...', icon: '💫', delay: 7000 },
  { percent: 76, text: 'Blending colors & texture matching...', icon: '🎨', delay: 6000 },
  { percent: 88, text: 'Final rendering & quality check...', icon: '⚡', delay: 5000 },
  { percent: 95, text: 'Fetching result from server...', icon: '📥', delay: 4000 },
  { percent: 100, text: 'Face swap process completed!', icon: '🎉', delay: 1500 }
];

// Total: ~45 detik

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
    '<blockquote>FACE SWAP VIP - ' + OWNER_NAME + "'s BOT</blockquote>\n\n" +
    icon + ' <b>' + text + '</b>\n\n' +
    '<code>' + bar + '</code>\n' +
    '<b>' + percent + '%</b> Completed - Step [' + stepIndex + '/' + totalSteps + ']\n\n' +
    '<i>Please wait, process takes 45-60 seconds...</i>\n' +
    '<i>Do not send other messages until finished!</i>'
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
        '<blockquote>ACCESS DENIED - MEMBERSHIP REQUIRED</blockquote>\n\n' +
        'Hello <b>' + ctx.from.first_name + '</b>! \n\n' +
        'To use <b>Face Swap VIP Bot by ' + OWNER_NAME + '</b>, you must join our channel first.\n\n' +
        '<b>Benefits:</b>\n' +
        'Face Swap Unlimited & HD Quality\n' +
        'Fast Process (45-60 seconds)\n' +
        'No Watermark on Results\n' +
        'Free Feature Updates\n' +
        'Priority Support by ' + OWNER_NAME + '\n\n' +
        '<b>Click button below to join:</b>',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Join Channel VIP', url: 'https://t.me/' + channelName }],
              [{ text: 'I Already Joined', callback_data: 'verify_' + userId }]
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
    return ctx.reply('Error occurred. Please try again later.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// /START COMMAND
// ═══════════════════════════════════════════════════════════════════════════════
bot.command('start', checkMembership, async (ctx) => {
  const user = ctx.from;
  const stats = db.stats.get(user.id.toString()) || { count: 0 };
  
  await ctx.replyWithHTML(
    '<blockquote>WELCOME TO FACE SWAP VIP BOT</blockquote>\n\n' +
    'Welcome, <b>' + user.first_name + '</b>! \n\n' +
    '<b>About This Bot:</b>\n' +
    'Premium Face Swap Bot by <b>' + OWNER_NAME + '</b> with advanced AI that can swap faces between photos with realistic and high-quality results.\n\n' +
    '<b>How to Use:</b>\n' +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    '<b>Step 1:</b> Send <b>SOURCE</b> photo\n' +
    '   Face photo you want to move\n\n' +
    '<b>Step 2:</b> Send <b>TARGET</b> photo\n' +
    '   Photo whose face will be replaced\n\n' +
    '<b>Step 3:</b> Wait for process to complete\n' +
    '   Estimated time: <b>45-60 seconds</b>\n\n' +
    '<b>Tips for Best Results:</b>\n' +
    'Choose photos with clear & frontal faces\n' +
    'Ensure lighting is bright & even\n' +
    'Avoid covered faces (masks/sunglasses)\n' +
    'Use color photos, not black & white\n' +
    'Face position should face forward\n\n' +
    '<b>Your Stats:</b>\n' +
    'Total Face Swap: <b>' + stats.count + 'x</b>\n' +
    'Status: <b>VIP Active</b>\n' +
    'Limit: <b>Unlimited</b>\n\n' +
    '<b>Ready? Send your first photo now!</b>\n\n' +
    '<blockquote>' + REQUIRED_CHANNEL + ' | Owned by ' + OWNER_NAME + '</blockquote>',
    {
      reply_markup: {
        keyboard: [
          ['Start Face Swap', 'Full Guide'],
          ['Account Status', 'VIP Channel']
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
      '<blockquote>INVALID FORMAT</blockquote>\n\n' +
      'File is not an image. Please send JPG, PNG, or WEBP file.'
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
    '<blockquote>SOURCE PHOTO RECEIVED SUCCESSFULLY</blockquote>\n\n' +
    '<b>Photo Info:</b>\n' +
    'Type: <b>Source Photo (Face)</b>\n' +
    'Resolution: <b>' + width + 'x' + height + '</b>\n' +
    'Status: <b>Valid</b>\n\n' +
    '<b>NEXT STEP:</b>\n' +
    'Send <b>TARGET</b> photo now!\n\n' +
    '<b>What is target photo?</b>\n' +
    'Target photo is the photo whose face will be replaced with the face from the source photo you just sent.\n\n' +
    '<i>Waiting for second photo...</i>\n\n' +
    '<i>Type "cancel" anytime to cancel process</i>\n\n' +
    '<blockquote>Owned by ' + OWNER_NAME + '</blockquote>'
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
    '<blockquote>FACE SWAP VIP - ' + OWNER_NAME + "'s BOT</blockquote>\n\n" +
    '<b>Initializing system...</b>\n\n' +
    '<code>░░░░░░░░░░░░░░░░░░░░</code>\n' +
    '<b>0%</b> - Step [0/10]\n\n' +
    '<i>Please wait, do not send other messages...</i>'
  );
  
  try {
    // Get file URLs
    const sourceFile = await ctx.telegram.getFile(session.sourceFileId);
    const targetFile = await ctx.telegram.getFile(targetPhoto.file_id);
    
    const sourceUrl = 'https://api.telegram.org/file/bot' + BOT_TOKEN + '/' + sourceFile.file_path;
    const targetUrl = 'https://api.telegram.org/file/bot' + BOT_TOKEN + '/' + targetFile.file_path;
    
    // Start animation and API call simultaneously
    const apiUrl = FACE_SWAP_API + '?source=' + encodeURIComponent(sourceUrl) + '&target=' + encodeURIComponent(targetUrl);
    
    const apiPromise = axios.get(apiUrl, {
      timeout: 120000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FaceSwapVIP/2.0'
      }
    });
    
    const animationPromise = showProgressAnimation(bot, chatId, progressMsg.message_id);
    
    // Wait for both
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
          '<blockquote>FACE SWAP SUCCESSFUL - PREMIUM QUALITY</blockquote>\n\n' +
          '<b>Process Completed!</b>\n\n' +
          '<b>Process Details:</b>\n' +
          'Job ID: <code>' + jobId + '</code>\n' +
          'Status: <b>Success</b>\n' +
          'Quality: <b>HD Premium</b>\n' +
          'Processing Time: <b>~50-60 seconds</b>\n' +
          'AI Engine: <b>IkyyOfficial API</b>\n' +
          'Owner: <b>' + OWNER_NAME + '</b>\n\n' +
          '<b>Save This Photo!</b>\n' +
          'Face swap result will be lost if not saved. Press and hold photo to save to gallery.\n\n' +
          '<b>Want to Face Swap Again?</b>\n' +
          'Send 2 new photos (source & target) to start new process!\n\n' +
          '<blockquote>' + REQUIRED_CHANNEL + ' | Owned by ' + OWNER_NAME + '</blockquote>'
        ),
        parse_mode: 'HTML'
      }
    );
    
    updateStats(ctx.from.id);
    db.sessions.delete(userId);
    
  } catch (error) {
    console.error('Face Swap Error:', error.message);
    
    try {
      await ctx.telegram.deleteMessage(chatId, progressMsg.message_id);
    } catch (e) {}
    
    let errorDetail = '';
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorDetail = '<b>Timeout Error</b>\n\n' +
        'Process took too long (>120 seconds). This can happen because:\n' +
        'API server is busy/high traffic\n' +
        'Photo size too large\n' +
        'Unstable internet connection\n\n' +
        '<b>Solution:</b>\n' +
        'Try again in 1-2 minutes\n' +
        'Use photos under 2MB\n' +
        'Ensure stable internet connection';
    } else if (error.response?.status === 400) {
      errorDetail = '<b>Bad Request</b>\n\n' +
        'Invalid photo format or content. Make sure:\n' +
        'Both photos have clearly visible faces\n' +
        'Face is not too small in frame\n' +
        'Photo format is JPG or PNG\n' +
        'No multiple dominant faces';
    } else if (error.response?.status === 500 || error.response?.status === 502) {
      errorDetail = '<b>Server Error</b>\n\n' +
        'API server is experiencing issues. Try again in a few minutes.\n\n' +
        'Status: ' + error.response?.status + ' ' + error.response?.statusText;
    } else {
      errorDetail = '<b>System Error</b>\n\n' +
        error.message + '\n\n' +
        'Please try again or contact ' + OWNER_NAME + ' through channel ' + REQUIRED_CHANNEL + ' if error persists.';
    }
    
    await ctx.replyWithHTML(
      '<blockquote>FACE SWAP FAILED</blockquote>\n\n' +
      'Sorry, error occurred while processing face swap.\n\n' +
      errorDetail + '\n\n' +
      '<b>Try again with:</b>\n' +
      'Different photos with better quality\n' +
      'Ensure faces are clearly visible in both photos\n' +
      'File size not more than 5MB\n' +
      'Wait 1-2 minutes if server is busy\n\n' +
      '<blockquote>Owned by ' + OWNER_NAME + '</blockquote>'
    );
    
    db.sessions.delete(userId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════
bot.hears('Start Face Swap', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    '<blockquote>START FACE SWAP</blockquote>\n\n' +
    '<b>Send SOURCE photo now!</b> \n\n' +
    'Source photo is the face photo you want to move to another photo.\n\n' +
    '<b>Example:</b> Your selfie, favorite artist photo, etc.\n\n' +
    '<i>Total estimated time: 45-60 seconds for 2 photos</i>'
  );
});

bot.hears('Full Guide', checkMembership, (ctx) => {
  ctx.replyWithHTML(
    '<blockquote>COMPLETE FACE SWAP VIP GUIDE</blockquote>\n\n' +
    '<b>Step by Step Tutorial:</b>\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '<b>STEP 1 - Send Source Photo:</b>\n' +
    'Send photo with face you want to move\n' +
    'Wait for "Source photo received" confirmation\n' +
    'Make sure face is clearly visible & not blurry\n\n' +
    '<b>STEP 2 - Send Target Photo:</b>\n' +
    'Send second photo whose face will be replaced\n' +
    'Bot will automatically start process\n' +
    'Wait for progress animation 0% to 100%\n' +
    '<b>Estimated time: 45-60 seconds</b>\n\n' +
    '<b>STEP 3 - Get Result:</b>\n' +
    'Result photo will be sent automatically\n' +
    'Save immediately (photo not stored on server)\n' +
    'Send 2 new photos for another face swap\n\n' +
    '<b>DOs and DON Ts:</b>\n' +
    'DO: Frontal face photos, bright, clear\n' +
    'DO: JPG/PNG format under 5MB\n' +
    'DON\'T: Face too small in photo\n' +
    'DON\'T: Dark, blurry, or too many faces\n' +
    'DON\'T: Send messages while process is running\n\n' +
    '<b>Pro Tips by ' + OWNER_NAME + ':</b>\n' +
    'Use photos with neutral expression for best results\n' +
    'Same lighting on both photos = better results\n' +
    'Faces with similar angles (front/front or side/side)\n' +
    'If failed, try cropping photo so face is more dominant\n\n' +
    '<blockquote>Owned by ' + OWNER_NAME + '</blockquote>'
  );
});

bot.hears('Account Status', checkMembership, (ctx) => {
  const userId = ctx.from.id.toString();
  const user = db.users.get(userId);
  const stats = db.stats.get(userId) || { count: 0, lastUsed: null };
  
  const lastUsed = stats.lastUsed 
    ? new Date(stats.lastUsed).toLocaleString('en-US', { 
        day: 'numeric', month: 'long', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      })
    : 'Never used';
  
  ctx.replyWithHTML(
    '<blockquote>VIP ACCOUNT STATUS</blockquote>\n\n' +
    '<b>User Info:</b>\n' +
    'Name: <b>' + ctx.from.first_name + '</b>\n' +
    'User ID: <code>' + ctx.from.id + '</code>\n' +
    'Username: ' + (ctx.from.username ? '@' + ctx.from.username : '-') + '\n' +
    'Member Since: <b>' + (user ? new Date(user.joinDate).toLocaleDateString('en-US') : '-') + '</b>\n' +
    'Status: <b>VIP Active</b>\n\n' +
    '<b>Usage Statistics:</b>\n' +
    'Total Face Swap: <b>' + stats.count + 'x</b>\n' +
    'Last Used: <b>' + lastUsed + '</b>\n' +
    'Daily Limit: <b>Unlimited</b>\n' +
    'Quality: <b>HD Premium</b>\n' +
    'Bot Owner: <b>' + OWNER_NAME + '</b>\n\n' +
    '<b>Ready for next face swap!</b>\n\n' +
    '<blockquote>Owned by ' + OWNER_NAME + '</blockquote>'
  );
});

bot.hears('VIP Channel', (ctx) => {
  const channelName = REQUIRED_CHANNEL.replace('@', '');
  ctx.replyWithHTML(
    '<blockquote>VIP CHANNEL COMMUNITY</blockquote>\n\n' +
    'Join our channel for:\n' +
    'Latest feature updates from ' + OWNER_NAME + '\n' +
    'Giveaways & special events\n' +
    'User community\n' +
    'Help & support 24/7\n\n' +
    '<b>Click button below to join:</b>',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Join Channel VIP', url: 'https://t.me/' + channelName }]
        ]
      }
    }
  );
});

// Cancel handler
bot.hears(['cancel', 'Cancel', 'batal', 'Batal'], checkMembership, (ctx) => {
  const userId = ctx.from.id.toString();
  db.sessions.delete(userId);
  
  ctx.replyWithHTML(
    '<blockquote>PROCESS CANCELLED</blockquote>\n\n' +
    'Face swap process has been cancelled.\n\n' +
    '<b>All temporary data has been deleted.</b>\n\n' +
    'Send <b>2 new photos</b> to start new face swap!\n\n' +
    '<blockquote>Owned by ' + OWNER_NAME + '</blockquote>'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// CALLBACK & ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
bot.action(/^verify_(.+)$/, async (ctx) => {
  const userId = ctx.match[1];
  if (userId !== ctx.from.id.toString()) {
    return ctx.answerCbQuery('Not for you!', { show_alert: true });
  }
  
  await ctx.answerCbQuery('Checking membership...');
  
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
        '<blockquote>VERIFICATION SUCCESSFUL</blockquote>\n\n' +
        'Welcome to <b>Face Swap VIP Bot by ' + OWNER_NAME + '</b>! \n\n' +
        'You now have full access to all premium features.\n\n' +
        'Click /start to see main menu and usage guide.',
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.answerCbQuery('You have not joined channel! Click "Join Channel VIP" first.', { show_alert: true });
    }
  } catch (error) {
    await ctx.answerCbQuery('Verification error. Try again!', { show_alert: true });
  }
});

bot.command('broadcast', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id.toString())) return ctx.reply('Admin only!');
  
  const text = ctx.message.text.slice(11).trim();
  if (!text) return ctx.reply('Format: /broadcast [your message]');
  
  let success = 0, failed = 0;
  
  for (const [userId] of db.users) {
    try {
      await ctx.telegram.sendMessage(userId,
        '<blockquote>ANNOUNCEMENT FROM ' + OWNER_NAME + '</blockquote>\n\n' + text,
        { parse_mode: 'HTML' }
      );
      success++;
      await new Promise(r => setTimeout(r, 50));
    } catch (e) { failed++; }
  }
  
  await ctx.reply('Broadcast:\n' + success + ' successful\n' + failed + ' failed');
});

bot.command('stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id.toString())) return ctx.reply('Admin only!');
  
  let totalSwaps = 0;
  for (const s of db.stats.values()) totalSwaps += s.count;
  
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  await ctx.replyWithHTML(
    '<blockquote>BOT STATISTICS - ADMIN PANEL</blockquote>\n\n' +
    '<b>Users:</b>\n' +
    'Total Users: <b>' + db.users.size + '</b>\n' +
    'Active Sessions: <b>' + db.sessions.size + '</b>\n\n' +
    '<b>Activity:</b>\n' +
    'Total Face Swap: <b>' + totalSwaps + '</b>\n' +
    'Average per User: <b>' + (db.users.size ? (totalSwaps / db.users.size).toFixed(1) : 0) + '</b>\n\n' +
    '<b>System:</b>\n' +
    'Uptime: <b>' + hours + 'h ' + minutes + 'm</b>\n' +
    'Memory: <b>' + (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB</b>\n' +
    'Owner: <b>' + OWNER_NAME + '</b>\n' +
    'API: <b>IkyyOfficial</b>\n\n' +
    '<blockquote>Face Swap VIP Bot v2.0 by ' + OWNER_NAME + '</blockquote>'
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
  console.error('Error:', err.message);
  ctx.replyWithHTML(
    '<blockquote>SYSTEM ERROR</blockquote>\n\n' +
    'An error occurred. Please try again.\n\n' +
    'Contact ' + OWNER_NAME + ' at ' + REQUIRED_CHANNEL + ' if it persists.'
  ).catch(() => {});
});

setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of db.sessions) {
    if (now - session.timestamp > 300000) db.sessions.delete(userId);
  }
}, 300000);

console.log('==============================================');
console.log('    FACE SWAP VIP BOT v2.0');
console.log('    Owner: ' + OWNER_NAME);
console.log('    API: IkyyOfficial');
console.log('==============================================');

bot.launch()
  .then(() => console.log('Bot running successfully!'))
  .catch(err => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

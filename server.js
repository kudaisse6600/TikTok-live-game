import express from 'express';
import {WebSocketServer, WebSocket} from 'ws';
import {WebcastPushConnection} from 'tiktok-live-connector';
import crypto from 'node:crypto';

const app=express();
const PORT=Number(process.env.PORT||3000);
const username=(process.env.TIKTOK_USERNAME||'').replace(/^@/,'').trim();
const ADMIN_KEY=process.env.ADMIN_KEY||crypto.randomBytes(18).toString('hex');
const maxGiftCoins=100000;
let status={connected:false,username:username||null,error:null,lastEvent:null};
let connector=null;
const recent=new Map();
const validUser=s=>typeof s==='string'&&s.length>0&&s.length<=80;
function broadcast(payload){const msg=JSON.stringify(payload);for(const c of wss.clients)if(c.readyState===WebSocket.OPEN)c.send(msg)}
function event(type,info){if(!validUser(info.user))return;const payload={type,user:info.user.replace(/^@/,''),...info,at:Date.now()};status.lastEvent=payload.at;broadcast(payload)}
function dedupe(key){const now=Date.now();for(const [k,v] of recent)if(now-v>90000)recent.delete(k);if(recent.has(key))return false;recent.set(key,now);return true}
function startTikTok(){if(!username){status.error='Set TIKTOK_USERNAME in your hosting environment';return}connector=new WebcastPushConnection(username,{enableExtendedGiftInfo:true});
connector.on('connected',()=>{status.connected=true;status.error=null;broadcast({type:'status',...status})});
connector.on('disconnected',()=>{status.connected=false;broadcast({type:'status',...status})});
connector.on('streamEnd',()=>{status.connected=false;broadcast({type:'status',...status})});
connector.on('error',err=>{status.error=String(err?.message||err).slice(0,160);broadcast({type:'status',...status})});
connector.on('chat',d=>{const msg=String(d.comment||'').trim().toUpperCase();if(msg==='RED'||msg==='BLUE'||msg==='!JOIN'||msg==='JOIN')event('chat',{user:d.uniqueId,comment:msg})});
connector.on('member',d=>event('join',{user:d.uniqueId}));
connector.on('follow',d=>event('follow',{user:d.uniqueId}));
connector.on('gift',d=>{if(d.giftType===1&&!d.repeatEnd)return;const repeat=Math.min(1000,Math.max(1,Number(d.repeatCount)||1));const unit=Math.min(maxGiftCoins,Math.max(0,Number(d.diamondCount)||0));const coins=Math.min(maxGiftCoins,repeat*unit);if(!coins)return;const key=`${d.uniqueId}:${d.giftId}:${d.repeatCount}:${d.repeatEnd}:${d.msgId||''}`;if(!dedupe(key))return;event('gift',{user:d.uniqueId,coins,giftName:String(d.giftName||'Gift').slice(0,60)})});
async function connect(){try{await connector.connect()}catch(err){status.connected=false;status.error=String(err?.message||err).slice(0,160);broadcast({type:'status',...status})}}
connect();setInterval(()=>{if(!status.connected)connect()},30000);
}
app.use(express.static('public'));
app.get('/api/status',(_req,res)=>res.json({connected:status.connected,username:status.username,error:status.error,lastEvent:status.lastEvent}));
const server=app.listen(PORT,()=>{console.log('Kingdom Wars running on port '+PORT);startTikTok()});
const wss=new WebSocketServer({server,path:'/events'});
wss.on('connection',ws=>{ws.send(JSON.stringify({type:'status',...status}))});
// No control endpoints exposed to public viewers. ADMIN_KEY reserved for future authenticated controls.

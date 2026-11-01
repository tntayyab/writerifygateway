import{h as m}from"./admin-neon-DyLsohq9.js";function ce(t){return t instanceof Uint8Array||ArrayBuffer.isView(t)&&t.constructor.name==="Uint8Array"&&"BYTES_PER_ELEMENT"in t&&t.BYTES_PER_ELEMENT===1}function w(t,e=""){if(typeof t!="number"){const n=e&&`"${e}" `;throw new TypeError(`${n}expected number, got ${typeof t}`)}if(!Number.isSafeInteger(t)||t<0){const n=e&&`"${e}" `;throw new RangeError(`${n}expected integer >= 0, got ${t}`)}}function Y(t,e,n=""){const r=ce(t),s=t?.length;if(!r||e!==void 0){const a=n&&`"${n}" `,i="",d=r?`length=${s}`:`type=${typeof t}`,l=a+"expected Uint8Array"+i+", got "+d;throw r?new RangeError(l):new TypeError(l)}return t}function se(t){if(typeof t!="function"||typeof t.create!="function")throw new TypeError("Hash must wrapped by utils.createHasher");if(w(t.outputLen),w(t.blockLen),t.outputLen<1)throw new Error('"outputLen" must be >= 1');if(t.blockLen<1)throw new Error('"blockLen" must be >= 1')}function z(t,e=!0){if(t.destroyed)throw new Error("Hash instance has been destroyed");if(e&&t.finished)throw new Error("Hash#digest() has already been called")}function re(t,e){Y(t,void 0,"digestInto() output");const n=e.outputLen;if(t.length<n)throw new RangeError('"digestInto() output" expected to be of length >='+n)}function K(t){return new Uint32Array(t.buffer,t.byteOffset,Math.floor(t.byteLength/4))}function P(...t){for(let e=0;e<t.length;e++)t[e].fill(0)}function V(t){return new DataView(t.buffer,t.byteOffset,t.byteLength)}function A(t,e){return t<<32-e|t>>>e}function u(t,e){return t<<e|t>>>32-e>>>0}const de=new Uint8Array(new Uint32Array([287454020]).buffer)[0]===68;function le(t){return t<<24&4278190080|t<<8&16711680|t>>>8&65280|t>>>24&255}function fe(t){for(let e=0;e<t.length;e++)t[e]=le(t[e]);return t}const J=de?t=>t:fe,ue=async()=>{};async function Q(t,e,n){let r=Date.now();for(let s=0;s<t;s++){n(s);const o=Date.now()-r;o>=0&&o<e||(await ue(),r+=o)}}function pe(t){if(typeof t!="string")throw new TypeError("string expected");return new Uint8Array(new TextEncoder().encode(t))}function Z(t,e=""){return typeof t=="string"?pe(t):Y(t,void 0,e)}function oe(t,e){if(e!==void 0&&{}.toString.call(e)!=="[object Object]")throw new TypeError("options must be object or undefined");return Object.assign(t,e)}function he(t,e={}){const n=(s,o)=>t(o).update(s).digest(),r=t(void 0);return n.outputLen=r.outputLen,n.blockLen=r.blockLen,n.canXOF=r.canXOF,n.create=s=>t(s),Object.assign(n,e),Object.freeze(n)}const ye=t=>({oid:Uint8Array.from([6,9,96,134,72,1,101,3,4,2,t])});class ee{oHash;iHash;blockLen;outputLen;canXOF=!1;finished=!1;destroyed=!1;constructor(e,n){if(se(e),Y(n,void 0,"key"),this.iHash=e.create(),typeof this.iHash.update!="function")throw new Error("Expected instance of class which extends utils.Hash");this.blockLen=this.iHash.blockLen,this.outputLen=this.iHash.outputLen;const r=this.blockLen,s=new Uint8Array(r);s.set(n.length>r?e.create().update(n).digest():n);for(let o=0;o<s.length;o++)s[o]^=54;this.iHash.update(s),this.oHash=e.create();for(let o=0;o<s.length;o++)s[o]^=106;this.oHash.update(s),P(s)}update(e){return z(this),this.iHash.update(e),this}digestInto(e){z(this),re(e,this),this.finished=!0;const n=e.subarray(0,this.outputLen);this.iHash.digestInto(n),this.oHash.update(n),this.oHash.digestInto(n),this.destroy()}digest(){const e=new Uint8Array(this.oHash.outputLen);return this.digestInto(e),e}_cloneInto(e){e||=Object.create(Object.getPrototypeOf(this),{});const{oHash:n,iHash:r,finished:s,destroyed:o,blockLen:a,outputLen:i}=this;return e=e,e.finished=s,e.destroyed=o,e.blockLen=a,e.outputLen=i,e.oHash=n._cloneInto(e.oHash),e.iHash=r._cloneInto(e.iHash),e}clone(){return this._cloneInto()}destroy(){this.destroyed=!0,this.oHash.destroy(),this.iHash.destroy()}}const xe=(()=>{const t=((e,n,r)=>new ee(e,n).update(r).digest());return t.create=(e,n)=>new ee(e,n),t})();function be(t,e,n,r){se(t);const s=oe({dkLen:32,asyncTick:10},r),{c:o,dkLen:a,asyncTick:i}=s;if(w(o,"c"),w(a,"dkLen"),w(i,"asyncTick"),o<1)throw new Error("iterations (c) must be >= 1");if(a<1)throw new Error('"dkLen" must be >= 1');if(a>(2**32-1)*t.outputLen)throw new Error("derived key too long");const d=Z(e,"password"),l=Z(n,"salt"),f=new Uint8Array(a),c=xe.create(t,d),p=c._cloneInto().update(l);return{c:o,dkLen:a,asyncTick:i,DK:f,PRF:c,PRFSalt:p}}function ge(t,e,n,r,s){return t.destroy(),e.destroy(),r&&r.destroy(),P(s),n}function ae(t,e,n,r){const{c:s,dkLen:o,DK:a,PRF:i,PRFSalt:d}=be(t,e,n,r);let l;const f=new Uint8Array(4),c=V(f),p=new Uint8Array(i.outputLen);for(let y=1,x=0;x<o;y++,x+=i.outputLen){const h=a.subarray(x,x+i.outputLen);c.setInt32(0,y,!1),(l=d._cloneInto(l)).update(f).digestInto(p),h.set(p.subarray(0,h.length));for(let E=1;E<s;E++){i._cloneInto(l).update(p).digestInto(p);for(let b=0;b<h.length;b++)h[b]^=p[b]}}return ge(i,d,a,l,p)}function me(t,e,n){return t&e^~t&n}function we(t,e,n){return t&e^t&n^e&n}class Ee{blockLen;outputLen;canXOF=!1;padOffset;isLE;buffer;view;finished=!1;length=0;pos=0;destroyed=!1;constructor(e,n,r,s){this.blockLen=e,this.outputLen=n,this.padOffset=r,this.isLE=s,this.buffer=new Uint8Array(e),this.view=V(this.buffer)}update(e){z(this),Y(e);const{view:n,buffer:r,blockLen:s}=this,o=e.length;for(let a=0;a<o;){const i=Math.min(s-this.pos,o-a);if(i===s){const d=V(e);for(;s<=o-a;a+=s)this.process(d,a);continue}r.set(e.subarray(a,a+i),this.pos),this.pos+=i,a+=i,this.pos===s&&(this.process(n,0),this.pos=0)}return this.length+=e.length,this.roundClean(),this}digestInto(e){z(this),re(e,this),this.finished=!0;const{buffer:n,view:r,blockLen:s,isLE:o}=this;let{pos:a}=this;n[a++]=128,P(this.buffer.subarray(a)),this.padOffset>s-a&&(this.process(r,0),a=0);for(let c=a;c<s;c++)n[c]=0;r.setBigUint64(s-8,BigInt(this.length*8),o),this.process(r,0);const i=V(e),d=this.outputLen;if(d%4)throw new Error("_sha2: outputLen must be aligned to 32bit");const l=d/4,f=this.get();if(l>f.length)throw new Error("_sha2: outputLen bigger than state");for(let c=0;c<l;c++)i.setUint32(4*c,f[c],o)}digest(){const{buffer:e,outputLen:n}=this;this.digestInto(e);const r=e.slice(0,n);return this.destroy(),r}_cloneInto(e){e||=new this.constructor,e.set(...this.get());const{blockLen:n,buffer:r,length:s,finished:o,destroyed:a,pos:i}=this;return e.destroyed=a,e.finished=o,e.length=s,e.pos=i,s%n&&e.buffer.set(r),e}clone(){return this._cloneInto()}}const k=Uint32Array.from([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]),Le=Uint32Array.from([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]),O=new Uint32Array(64);class Ae extends Ee{constructor(e){super(64,e,8,!1)}get(){const{A:e,B:n,C:r,D:s,E:o,F:a,G:i,H:d}=this;return[e,n,r,s,o,a,i,d]}set(e,n,r,s,o,a,i,d){this.A=e|0,this.B=n|0,this.C=r|0,this.D=s|0,this.E=o|0,this.F=a|0,this.G=i|0,this.H=d|0}process(e,n){for(let c=0;c<16;c++,n+=4)O[c]=e.getUint32(n,!1);for(let c=16;c<64;c++){const p=O[c-15],y=O[c-2],x=A(p,7)^A(p,18)^p>>>3,h=A(y,17)^A(y,19)^y>>>10;O[c]=h+O[c-7]+x+O[c-16]|0}let{A:r,B:s,C:o,D:a,E:i,F:d,G:l,H:f}=this;for(let c=0;c<64;c++){const p=A(i,6)^A(i,11)^A(i,25),y=f+p+me(i,d,l)+Le[c]+O[c]|0,h=(A(r,2)^A(r,13)^A(r,22))+we(r,s,o)|0;f=l,l=d,d=i,i=a+y|0,a=o,o=s,s=r,r=y+h|0}r=r+this.A|0,s=s+this.B|0,o=o+this.C|0,a=a+this.D|0,i=i+this.E|0,d=d+this.F|0,l=l+this.G|0,f=f+this.H|0,this.set(r,s,o,a,i,d,l,f)}roundClean(){P(O)}destroy(){this.destroyed=!0,this.set(0,0,0,0,0,0,0,0),P(this.buffer)}}class ke extends Ae{A=k[0]|0;B=k[1]|0;C=k[2]|0;D=k[3]|0;E=k[4]|0;F=k[5]|0;G=k[6]|0;H=k[7]|0;constructor(){super(32)}}const ie=he(()=>new ke,ye(1));function te(t,e,n,r,s,o){let a=t[e++]^n[r++],i=t[e++]^n[r++],d=t[e++]^n[r++],l=t[e++]^n[r++],f=t[e++]^n[r++],c=t[e++]^n[r++],p=t[e++]^n[r++],y=t[e++]^n[r++],x=t[e++]^n[r++],h=t[e++]^n[r++],E=t[e++]^n[r++],b=t[e++]^n[r++],L=t[e++]^n[r++],j=t[e++]^n[r++],M=t[e++]^n[r++],G=t[e++]^n[r++],g=a,_=i,T=d,H=l,S=f,R=c,I=p,N=y,U=x,C=h,W=E,D=b,$=L,v=j,F=M,B=G;for(let q=0;q<8;q+=2)S^=u(g+$|0,7),U^=u(S+g|0,9),$^=u(U+S|0,13),g^=u($+U|0,18),C^=u(R+_|0,7),v^=u(C+R|0,9),_^=u(v+C|0,13),R^=u(_+v|0,18),F^=u(W+I|0,7),T^=u(F+W|0,9),I^=u(T+F|0,13),W^=u(I+T|0,18),H^=u(B+D|0,7),N^=u(H+B|0,9),D^=u(N+H|0,13),B^=u(D+N|0,18),_^=u(g+H|0,7),T^=u(_+g|0,9),H^=u(T+_|0,13),g^=u(H+T|0,18),I^=u(R+S|0,7),N^=u(I+R|0,9),S^=u(N+I|0,13),R^=u(S+N|0,18),D^=u(W+C|0,7),U^=u(D+W|0,9),C^=u(U+D|0,13),W^=u(C+U|0,18),$^=u(B+F|0,7),v^=u($+B|0,9),F^=u(v+$|0,13),B^=u(F+v|0,18);s[o++]=a+g|0,s[o++]=i+_|0,s[o++]=d+T|0,s[o++]=l+H|0,s[o++]=f+S|0,s[o++]=c+R|0,s[o++]=p+I|0,s[o++]=y+N|0,s[o++]=x+U|0,s[o++]=h+C|0,s[o++]=E+W|0,s[o++]=b+D|0,s[o++]=L+$|0,s[o++]=j+v|0,s[o++]=M+F|0,s[o++]=G+B|0}function X(t,e,n,r,s){let o=r+0,a=r+16*s;for(let i=0;i<16;i++)n[a+i]=t[e+(2*s-1)*16+i];for(let i=0;i<s;i++,o+=16,e+=16)te(n,a,t,e,n,o),i>0&&(a+=16),te(n,o,t,e+=16,n,a)}function Oe(t,e,n){const r=oe({dkLen:32,asyncTick:10,maxmem:1073742848},n),{N:s,r:o,p:a,dkLen:i,asyncTick:d,maxmem:l,onProgress:f}=r;if(w(s,"N"),w(o,"r"),w(a,"p"),w(i,"dkLen"),w(d,"asyncTick"),w(l,"maxmem"),f!==void 0&&typeof f!="function")throw new Error("progressCb must be a function");const c=128*o,p=c/4,y=Math.pow(2,32);if(s<=1||(s&s-1)!==0||s>y)throw new Error('"N" expected a power of 2, and 2^1 <= N <= 2^32');if(a<1||a>(y-1)*32/c)throw new Error('"p" expected integer 1..((2^32 - 1) * 32) / (128 * r)');if(i<1||i>(y-1)*32)throw new Error('"dkLen" expected integer 1..(2^32 - 1) * 32');const x=c*(s+a+1);if(x>l)throw new Error('"maxmem" limit was hit: memUsed(128*r*(N+p+1))='+x+", maxmem="+l);const h=ae(ie,t,e,{c:1,dkLen:c*a}),E=K(h),b=K(new Uint8Array(c*s)),L=K(new Uint8Array(c));let j=()=>{};if(f){const M=2*s*a,G=Math.max(Math.floor(M/1e4),1);let g=0;j=()=>{g++,f&&(!(g%G)||g===M)&&f(g/M)}}return{N:s,r:o,p:a,dkLen:i,blockSize32:p,V:b,B32:E,B:h,tmp:L,blockMixCb:j,asyncTick:d}}function _e(t,e,n,r,s){const o=ae(ie,t,n,{c:1,dkLen:e});return P(n,r,s),o}async function Te(t,e,n){const{N:r,r:s,p:o,dkLen:a,blockSize32:i,V:d,B32:l,B:f,tmp:c,blockMixCb:p,asyncTick:y}=Oe(t,e,n);J(l);for(let x=0;x<o;x++){const h=i*x;for(let b=0;b<i;b++)d[b]=l[h+b];let E=0;await Q(r-1,y,()=>{X(d,E,d,E+=i,s),p()}),X(d,(r-1)*i,l,h,s),p(),await Q(r,y,()=>{const b=(l[h+i-16]&r-1)>>>0;for(let L=0;L<i;L++)c[L]=l[h+L]^d[b*i+L];X(c,0,l,h,s),p()})}return J(l),_e(t,a,f,d,c)}async function He(t){const e=new Uint8Array(16);crypto.getRandomValues(e);const n=Array.from(e).map(a=>a.toString(16).padStart(2,"0")).join(""),r=new TextEncoder().encode(n),s=await Te(t.normalize("NFKC"),r,{N:16384,r:16,p:1,dkLen:64,maxmem:128*16384*16*2}),o=Array.from(s).map(a=>a.toString(16).padStart(2,"0")).join("");return`${n}:${o}`}function ne(t=32){const e=new Uint8Array(Math.ceil(t/2));return crypto.getRandomValues(e),Array.from(e).map(n=>n.toString(16).padStart(2,"0")).join("").slice(0,t)}async function Se(){try{const t=await m("SELECT id, key, COALESCE(value, '') as value FROM public.kyros_gateway_settings;"),e={};for(const n of t)e[n.key]=n.value;return e}catch(t){return console.warn("[Kyros Settings] Failed to fetch settings:",t),{}}}async function Ue(t,e){const n=t.trim().replace(/'/g,"''"),r=e.trim().replace(/'/g,"''"),s=`
    INSERT INTO public.kyros_gateway_settings (key, value, updated_at)
    VALUES ('${n}', '${r}', NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  `;return await m(s),!0}async function Re(t){try{const e=await Se(),n=e.resend_api_key?.trim(),r=e.email_from?.trim()||"Writerify Gateway <onboarding@resend.dev>";if(!n)return console.warn("[Resend] No RESEND_API_KEY set in kyros_gateway_settings."),{success:!1,error:"Resend API key is not configured in Admin Settings. (Contact Writerify Admin)"};const s={from:r,to:[t.to],subject:t.subject,html:t.html,text:t.text||t.subject},o=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${n}`,"Content-Type":"application/json"},body:JSON.stringify(s)}),a=await o.json();return o.ok?{success:!0,id:a.id}:(console.error("[Resend Error]",a),{success:!1,error:a.message||`Resend error (${o.status})`})}catch(e){return console.error("[Resend Exception]",e),{success:!1,error:e.message||"Failed to dispatch email"}}}function Ie(t,e){return`
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Account Approved - Writerify Gateway</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #111827; border-radius: 16px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <!-- Header -->
            <tr>
              <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1f2937;">
                <div style="display: inline-block; padding: 8px 16px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 9999px; font-size: 13px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                  🎉 ACCESS GRANTED
                </div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                  Welcome to Writerify Gateway
                </h1>
                <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">
                  Your account has been officially approved!
                </p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding: 32px;">
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #e2e8f0; line-height: 1.5;">
                  Hello <strong>${t}</strong>,
                </p>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                  Great news! Your Writerify Gateway account (<strong>${e}</strong>) has been reviewed and <strong style="color: #4ade80;">approved by Writerify</strong>.
                </p>
                <p style="margin: 0 0 28px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                  You now have full access to our multi-model AI routing, high-performance harnesses, fallback engines, and intelligent playground.
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin-bottom: 28px;">
                  <a href="https://gateway.writerify.org/login" style="background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.4);">
                    Log In to Writerify Gateway &rarr;
                  </a>
                </div>

                <div style="background-color: #0f172a; border-radius: 8px; padding: 16px; font-size: 13px; color: #64748b; line-height: 1.5;">
                  <strong>Quick tip:</strong> Sign in with your registered email and password. If you ever need help, reach out directly to Admin at <a href="mailto:itsinjamul@gmail.com" style="color: #38bdf8; text-decoration: none;">itsinjamul@gmail.com</a>.
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding: 20px 32px; background-color: #0b0f19; border-top: 1px solid #1f2937; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #475569;">
                  &copy; ${new Date().getFullYear()} Writerify Gateway &bull; https://gateway.writerify.org
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `}async function Ce(t,e,n){const r=e.trim().toLowerCase(),s=t.trim();if(!r||!r.includes("@"))return{success:!1,error:"Please enter a valid email address."};if(!n||n.length<8)return{success:!1,error:"Password must be at least 8 characters long."};const o=await m(`SELECT status FROM public.kyros_access_control WHERE LOWER(email) = LOWER('${r.replace(/'/g,"''")}');`);if(o.length>0&&(o[0].status==="rejected"||o[0].status==="revoked"))return{success:!1,error:"Access Denied: This account has been blocked by Admin (Boss TN TAYYAB)."};if((await m(`SELECT id, email FROM public.user WHERE LOWER(email) = LOWER('${r.replace(/'/g,"''")}');`)).length>0)return{success:!1,error:"An account with this email already exists. Please log in instead."};const i=await He(n),d=r.replace(/'/g,"''"),l=s.replace(/'/g,"''"),f=i.replace(/'/g,"''");return await m(`
    INSERT INTO public.kyros_access_control (email, name, role, status, plan, notes, password_hash, is_email_verified, created_at, updated_at)
    VALUES ('${d}', '${l}', 'member', 'pending', 'free_trial', 'Direct Registration - Pending Admin Approval', '${f}', true, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE 
    SET name = EXCLUDED.name, 
        password_hash = EXCLUDED.password_hash, 
        status = 'pending', 
        is_email_verified = true,
        notes = 'Direct Registration - Pending Admin Approval', 
        updated_at = NOW();
  `),{success:!0}}async function We(t,e="Writerify"){const n=t.trim().toLowerCase(),r=n.replace(/'/g,"''"),s=e.replace(/'/g,"''"),o=await m(`
    SELECT id, email, name, password_hash
    FROM public.kyros_access_control
    WHERE LOWER(email) = LOWER('${r}');
  `);if(o.length===0)return{success:!1,error:"User record not found in access control."};const a=o[0],i=a.name||"Member",d=i.replace(/'/g,"''");let f=(await m(`
    SELECT id, email FROM public.user WHERE LOWER(email) = LOWER('${r}');
  `))[0]?.id;if(f)await m(`
      UPDATE public.user SET "emailVerified" = true, "updatedAt" = NOW() WHERE id = '${f}';
    `);else{f=ne(32);const y=ne(32),x=a.password_hash||"";if(await m(`
      INSERT INTO public.user (id, name, email, "emailVerified", "createdAt", "updatedAt")
      VALUES ('${f}', '${d}', '${r}', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET "emailVerified" = true, "updatedAt" = NOW();
    `),x){const h=x.replace(/'/g,"''");await m(`
        INSERT INTO public.account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        VALUES ('${y}', '${f}', 'credential', '${f}', '${h}', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `)}}await m(`
    UPDATE public.kyros_access_control
    SET status = 'approved',
        approved_by = '${s}',
        is_email_verified = true,
        notes = 'Approved by Admin (Full Access Granted)',
        updated_at = NOW()
    WHERE LOWER(email) = LOWER('${r}');
  `);const c=Ie(i,n),p=await Re({to:n,subject:"🎉 Congratulations! Your Writerify Gateway Account is Approved",html:c,text:`Hello ${i}, your Writerify Gateway account has been approved by Writerify. You can now log in at https://gateway.writerify.org/login`});return{success:!0,emailSent:p.success,error:p.success?void 0:p.error}}async function De(){try{return await m(`
      SELECT id, email, code, name, is_verified, expires_at, created_at
      FROM public.kyros_email_verifications
      ORDER BY created_at DESC
      LIMIT 15;
    `)}catch{return[]}}export{De as a,We as b,Re as c,Se as g,Ce as s,Ue as u};

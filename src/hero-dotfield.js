/** Shared construction geometry. Default layers have exactly one centre. */
function heroDiamondLayers(width,height,pointer={x:0,y:0}){
  const usable=Math.min(width-(width<600?80:128),height-96);
  const radius=Math.max(24,usable*.42-18),cx=width/2,cy=height/2,depth=[3,7,12,18];
  return [{radius:radius+26,band:17,alpha:.065},{radius:radius+10,band:22,alpha:.085},{radius:radius-5,band:23,alpha:.115},{radius:Math.max(12,radius-27),band:13,alpha:.07}]
    .map((layer,i)=>({...layer,x:cx+pointer.x*depth[i],y:cy+pointer.y*depth[i]*.75}));
}
/** Configured title for the sheet plate; the hero backdrop also renders outside the plugin (tests). */
function titleName(){
  return typeof options==='object'&&options&&typeof options.titleName==='string'&&options.titleName?options.titleName:'AIC';
}
function installHeroDotfield(){
  if(typeof document.querySelector!=='function'||typeof ResizeObserver!=='function')return()=>{};
  let host=null,canvas=null,context=null,gpu=null,baseImage=null,rulers=null,plateTitle=null;
  let guides=[];
  let waves=[],width=0,height=0,frame=0,cachedDark=null,scale=2,lastPaint=0;
  let pointer={x:0,y:0},targetPointer={x:0,y:0},cachedPointer={x:0,y:0};
  let disposed=false,press=null,gpuDisabled=false;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionAllowed=()=>document.body.dataset.aicMotion!=='off'&&!reduced.matches;
  const requestPaint=()=>{if(!frame&&canvas&&!disposed&&document.visibilityState!=='hidden')frame=requestAnimationFrame(paint);};
  const traceDiamond=(ctx,x,y,r)=>{ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();};
  const buildBase=()=>{
    if(!baseImage)baseImage=document.createElement('canvas');
    if(baseImage.width!==canvas.width||baseImage.height!==canvas.height){baseImage.width=canvas.width;baseImage.height=canvas.height;}
    const ctx=baseImage.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);
    ctx.fillStyle=ctx.strokeStyle=cachedDark?'#D4D4D4':'#525252';
    for(const[index,l]of heroDiamondLayers(width,height,pointer).entries()){
      const inner=Math.max(5,l.radius-l.band*Math.SQRT2);
      ctx.beginPath();traceDiamond(ctx,l.x,l.y,l.radius);traceDiamond(ctx,l.x,l.y,inner);ctx.globalAlpha=l.alpha;ctx.fill('evenodd');
      ctx.beginPath();traceDiamond(ctx,l.x,l.y,l.radius);ctx.lineWidth=1;ctx.globalAlpha=.12+index*.025;ctx.stroke();
      ctx.beginPath();traceDiamond(ctx,l.x,l.y,inner);ctx.lineWidth=.75;ctx.globalAlpha=.075;ctx.stroke();
    }
    cachedPointer={...pointer};
  };
  const createRulers=()=>{
    if(typeof host.append!=='function')return;
    rulers=document.createElement('div');rulers.className='aic-hero-rulers';rulers.setAttribute('aria-hidden','true');
    const svgNS='http://www.w3.org/2000/svg';
    for(const side of ['top-left','top-right','bottom-left','bottom-right']){
      const corner=document.createElement('span');corner.className='aic-hero-corner aic-hero-corner-'+side;
      const line=document.createElementNS(svgNS,'svg');line.setAttribute('viewBox','0 0 60 40');line.setAttribute('preserveAspectRatio','none');line.classList.add('aic-hero-corner-line');
      const fold=document.createElementNS(svgNS,'path');fold.setAttribute('d','M0 40V12L12 0H60');fold.setAttribute('vector-effect','non-scaling-stroke');line.append(fold);
      const triangle=document.createElementNS(svgNS,'svg');triangle.setAttribute('viewBox','0 0 16 16');triangle.classList.add('aic-hero-corner-triangle');
      const outline=document.createElementNS(svgNS,'path');outline.setAttribute('d','M3 2L14 8L3 14Z');triangle.append(outline);
      corner.append(line,triangle);rulers.append(corner);
    }
    for(const side of ['left','right','top','bottom']){
      const axis=document.createElement('div');axis.className='aic-hero-axis aic-hero-axis-'+side;
      const track=document.createElement('i');track.className='aic-hero-axis-track';axis.append(track);
      const vertical=side==='left'||side==='right';
      for(let i=0;i<7;i++){
        const label=document.createElement('span');label.className='aic-hero-axis-label';const value=vertical?60-i*20:i*20-60;
        label.textContent=String(value);label.dataset.zero=String(value===0);label.style.setProperty('--tick-position',i/6*100+'%');axis.append(label);
      }
      const indicator=document.createElement('b');indicator.className='aic-hero-axis-pointer';axis.append(indicator);rulers.append(axis);
    }
    // Sheet annotations: a small drafting title block and two construction
    // witnesses that meet the diamond's outer apex. They are static, click-
    // through and live inside the removable instrumentation layer.
    const plate=document.createElement('div');plate.className='aic-hero-plate';plate.setAttribute('aria-hidden','true');
    plateTitle=document.createElement('span');plateTitle.className='aic-hero-plate-title';plate.append(plateTitle);
    for(const label of ['SHEET 01 / 01','GRID 96 / 48','SCALE 1:1','ORIGIN 0 / 0']){
      const cell=document.createElement('span');cell.textContent=label;plate.append(cell);
    }
    rulers.append(plate);
    plateTitle.textContent=titleName()+' / NEW SESSION';
    host.append(rulers);
  };
  // Witness lines run from the sheet frame to the outer diamond's vertices.
  // They are re-derived on every resize so they keep meeting the drawing.
  const syncGuides=()=>{
    for(const guide of guides)guide.remove();
    guides=[];
    if(!rulers||!width||!height)return;
    const layers=heroDiamondLayers(width,height),outer=layers[0].radius,centreY=height/2;
    const witnesses=[['top',centreY-outer-42],['bottom',height-42-(centreY+outer)]];
    for(const [kind,size] of witnesses){
      if(size<6)continue;
      const guide=document.createElement('i');guide.className='aic-hero-guide aic-hero-guide-'+kind;
      guide.style.height=size+'px';
      if(kind==='top')guide.style.top='42px';else guide.style.bottom='42px';
      rulers.append(guide);guides.push(guide);
    }
  };
  const measure=()=>{
    if(!host||!canvas)return;
    const b=host.getBoundingClientRect(),w=Math.round(b.width),h=Math.round(b.height),dark=document.body.hasAttribute('data-ds-dark-theme');
    if(width!==w||height!==h||cachedDark!==dark){
      width=w;height=h;cachedDark=dark;pointer={x:0,y:0};targetPointer={x:0,y:0};lastPaint=0;
      canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
      if(gpu)gpu.resize(width,height,0,0,dark);else buildBase();
      canvas.dataset.shape='layered-hollow-diamond';canvas.dataset.nodeShape='continuous';canvas.dataset.layerCount='4';
      canvas.dataset.renderStrategy=gpu?'gpu-mask':'cached-mask';canvas.dataset.renderScale=String(scale);canvas.dataset.fieldTone=dark?'silver':'grey';waves=[];
      syncGuides();
    }
    requestPaint();
  };
  const resize=new ResizeObserver(measure);
  function detach(){
    resize.disconnect();if(frame)cancelAnimationFrame(frame);frame=0;
    if(gpu)canvas?.removeEventListener('webglcontextlost',contextLost);
    canvas?.remove();rulers?.remove();rulers=null;plateTitle=null;guides=[];
    for(const key of ['--aic-cursor-x','--aic-cursor-y'])host?.style?.removeProperty(key);
    gpu?.dispose();gpu=null;if(baseImage)baseImage.width=baseImage.height=0;
    host=canvas=context=baseImage=null;cachedDark=null;waves=[];width=height=0;
  }
  function contextLost(event){event.preventDefault();gpuDisabled=true;detach();sync();}
  function sync(){
    if(disposed)return;
    const target=document.body.dataset.aicDecoration==='off'?null:document.querySelector('[data-content-phase="hero"]');
    if(target!==host||(canvas&&!canvas.isConnected)){
      detach();
      if(target){
        host=target;canvas=document.createElement('canvas');
        if(!gpuDisabled&&typeof createHeroDotfieldGpu==='function'){gpu=createHeroDotfieldGpu(canvas);if(!gpu)canvas=document.createElement('canvas');}
        canvas.className='aic-hero-dotfield';canvas.setAttribute('aria-hidden','true');canvas.dataset.fieldState='static';
        context=gpu?null:canvas.getContext('2d',{alpha:true});if(!context&&!gpu){detach();return;}
        if(gpu)canvas.addEventListener('webglcontextlost',contextLost);
        host.prepend(canvas);createRulers();resize.observe(host);measure();
      }
    }
    if(!motionAllowed()){waves=[];pointer={x:0,y:0};targetPointer={x:0,y:0};}measure();
  }
  function paint(now){
    frame=0;if((!context&&!gpu)||!canvas||!host?.isConnected||disposed)return;
    if(!motionAllowed()){waves=[];pointer={x:0,y:0};targetPointer={x:0,y:0};}
    waves=waves.filter(w=>now-w.started<w.lifetime);
    const ease=1-Math.exp(-Math.min(50,lastPaint?now-lastPaint:16)/105);lastPaint=now;
    pointer.x+=(targetPointer.x-pointer.x)*ease;pointer.y+=(targetPointer.y-pointer.y)*ease;
    const moving=Math.abs(targetPointer.x-pointer.x)+Math.abs(targetPointer.y-pointer.y)>.0008;if(!moving)pointer={...targetPointer};
    canvas.dataset.parallaxX=String(Math.round(pointer.x*18000)/1000);canvas.dataset.parallaxY=String(Math.round(pointer.y*13500)/1000);
    canvas.dataset.fieldState=waves.length?'ripple':moving?'parallax':'static';canvas.dataset.rippleCount=String(waves.length);
    if(guides.length){const shift=(pointer.x*3).toFixed(2);for(const guide of guides)guide.style.transform='translateX('+shift+'px)';}
    if(gpu)gpu.draw(waves,now,pointer);
    else{
      if(cachedPointer.x!==pointer.x||cachedPointer.y!==pointer.y)buildBase();
      context.setTransform(scale,0,0,scale,0,0);context.clearRect(0,0,width,height);context.globalAlpha=1;context.drawImage(baseImage,0,0,width,height);context.strokeStyle=cachedDark?'#D4D4D4':'#525252';
      for(const w of waves){const age=now-w.started;context.beginPath();context.arc(w.x,w.y,age*.62,0,Math.PI*2);context.lineWidth=1.3;context.globalAlpha=Math.exp(-age/1400)*.16;context.stroke();}context.globalAlpha=1;
    }
    if(waves.length||moving)requestPaint();
  }
  function resetPointer(){targetPointer={x:0,y:0};host?.style?.setProperty('--aic-cursor-x','50%');host?.style?.setProperty('--aic-cursor-y','50%');requestPaint();}
  function pointerMove(event){
    if(!host||event.pointerType==='touch')return;
    if(!host.contains(event.target)||event.target.closest?.('[role="dialog"],[data-trigger-menu]')){resetPointer();return;}
    const bounds=host.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top,clamp=v=>Math.max(0,Math.min(1,v));
    const margin=width<600?44:74,rx=clamp((x-margin)/Math.max(1,width-margin*2)),ry=clamp((y-54)/Math.max(1,height-108));
    host.style?.setProperty('--aic-cursor-x',rx*100+'%');host.style?.setProperty('--aic-cursor-y',ry*100+'%');
    if(rulers){rulers.dataset.cursorX=String(Math.round(rx*1000)/10);rulers.dataset.cursorY=String(Math.round(ry*1000)/10);}
    targetPointer=motionAllowed()?{x:clamp(x/width)*2-1,y:clamp(y/height)*2-1}:{x:0,y:0};requestPaint();
  }
  function pointerDown(event) { press = event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null; }
  function pointerUp(event) {
    const started = press; press = null;
    if (!started || event.pointerId !== started.id || Math.hypot(event.clientX - started.x, event.clientY - started.y) > 8) return;
    if (!host || !canvas || !host.contains(event.target) || !motionAllowed()) return;
    if (event.target.closest?.('button,a,input,textarea,select,[role="textbox"],[role="dialog"],[data-trigger-menu]')) return;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    const farthest = Math.max(Math.hypot(x, y), Math.hypot(width - x, y), Math.hypot(x, height - y), Math.hypot(width - x, height - y));
    waves = [...waves.slice(-5), { x, y, started: performance.now(), lifetime: (farthest + 100) / .62 }];
    canvas.dataset.lastRippleX = String(Math.round(x)); canvas.dataset.lastRippleY = String(Math.round(y));
    requestPaint();
  }
  function visibility() {
    if (document.visibilityState === 'hidden') { waves = []; if (frame) cancelAnimationFrame(frame); frame = 0; }
    else requestPaint();
  }
  const stopOptions = typeof subscribe === 'function' ? subscribe(() => { if (plateTitle) plateTitle.textContent = titleName() + ' / NEW SESSION'; }) : () => {};
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-content-phase', 'data-aic-decoration', 'data-aic-motion', 'data-ds-dark-theme'] });
  document.addEventListener('pointerdown', pointerDown, { capture: true, passive: true });
  document.addEventListener('pointerup', pointerUp, { capture: true, passive: true });
  document.addEventListener('pointermove', pointerMove, { passive: true });
  document.addEventListener('pointerleave', resetPointer);
  document.addEventListener('visibilitychange', visibility);
  reduced.addEventListener('change', sync);
  sync();
  return () => {
    disposed = true; observer.disconnect(); stopOptions(); detach();
    document.removeEventListener('pointerdown', pointerDown, true);
    document.removeEventListener('pointerup', pointerUp, true);
    document.removeEventListener('pointermove', pointerMove);
    document.removeEventListener('pointerleave', resetPointer);
    document.removeEventListener('visibilitychange', visibility);
    reduced.removeEventListener('change', sync);
  };
}

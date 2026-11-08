/** Original Huawei TTFs travel in sibling chunks, never in the startup bundle. */
function installHarmonyFonts() {
  if (typeof FontFace !== 'function' || !document.fonts?.add) return () => {};
  const owner = runtime, registered = [];
  let active = true;
  const faces = [
    [400, 'Regular', './client.harmony-regular.js'],
    [500, 'Medium', './client.harmony-medium.js'],
    [700, 'Bold', './client.harmony-bold.js'],
  ];
  owner.harmonyReady = Promise.all(faces.map(async ([weight, name, chunk]) => {
    const descriptors = { weight: String(weight), style: 'normal', display: 'swap' };
    let face, source = 'local';
    try {
      try {
        const localSource = weight === 400 ? 'local("HarmonyOS Sans SC"),local("HarmonyOS_Sans_SC")'
          : `local("HarmonyOS Sans SC ${name}"),local("HarmonyOS_Sans_SC_${name}")`;
        face = await new FontFace('HarmonyOS Sans SC', localSource, descriptors).load();
      } catch {
        if (!active) return { weight, loaded: false, source: 'disposed' };
        source = 'bundled';
        const module = await require.async(chunk);
        if (!active) return { weight, loaded: false, source: 'disposed' };
        face = await new FontFace('HarmonyOS Sans SC', module.source, descriptors).load();
      }
      if (active) { document.fonts.add(face); registered.push(face); }
      return { weight, loaded: active, source: active ? source : 'disposed' };
    } catch { return { weight, loaded: false, source: 'fallback' }; }
  }));
  return () => { active = false; for (const face of registered) document.fonts.delete(face); };
}

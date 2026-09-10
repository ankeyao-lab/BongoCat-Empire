import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '/Users/Harry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const output = new URL('../../research/empire-v1.8.1/', import.meta.url)
await mkdir(output,{recursive:true})
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const errors=[], failures=[], checks=[]
try {
  const page = await browser.newPage({viewport:{width:1000,height:780},deviceScaleFactor:1})
  page.on('pageerror',e=>errors.push(e.message))
  page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`)})
  const growthResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/src/composables/useGrowth.ts')
  const componentResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/src/components/growth/index.vue')
  await page.goto('http://127.0.0.1:1420/?preview=growth')
  await page.locator('.theme-grid').waitFor()
  await page.evaluate(async({growthURL,componentURL})=>{
    const {createApp,h,ref,watch,nextTick}=await import('/node_modules/.vite/deps/vue.js')
    const {createPinia}=await import('/node_modules/.vite/deps/pinia.js')
    const {i18n}=await import('/src/locales/index.ts')
    const {default:Growth}=await import(componentURL)
    const growth=(await import(growthURL)).useGrowth()
    if(!growth.isDemo)throw new Error('This test must use browser demo data only')
    // Deterministic native diagnostics are UI fixtures, never native acceptance.
    window.__TAURI_OS_PLUGIN_INTERNALS__={platform:'macos',arch:'aarch64',version:'test'}
    const fixture={phase:'recovering',permissionGranted:false,listening:false,lastEventAt:null,keyboardEvents:0,pointerEvents:0,buttonEvents:0,scrollEvents:0,recoveryCount:0,droppedEvents:0,error:'输入监控权限尚未对当前版本生效；若系统开关已开启，请在通用设置查看重新登记方法'}
    window.__TAURI_INTERNALS__={
      metadata:{currentWindow:{label:'preference'},currentWebview:{label:'preference'}},
      transformCallback:()=>1, unregisterCallback:()=>{},convertFileSrc:p=>p,
      invoke:async(cmd)=>{
        if(cmd==='get_device_listener_state'||cmd==='start_device_listening')return fixture
        if(cmd.includes('check_input_monitoring'))return false
        if(cmd.includes('is_enabled'))return false
        if(cmd==='plugin:path|resolve_directory')return '/test/logs'
        if(cmd==='plugin:event|listen')return 1
        return null
      },
    }
    const [{default:Shell},{default:More},{default:Cat},{default:General},{default:Model},{default:About},{useGeneralStore},{useAppStore}]=await Promise.all([
      import('/src/pages/preference/components/PreferenceShell.vue'),import('/src/pages/preference/components/MoreSettings.vue'),
      import('/src/pages/preference/components/cat/index.vue'),import('/src/pages/preference/components/general/index.vue'),
      import('/src/pages/preference/components/model/index.vue'),import('/src/pages/preference/components/about/index.vue'),
      import('/src/stores/general.ts'),import('/src/stores/app.ts'),
    ])
    document.querySelector('#app').__vue_app__?.unmount()
    document.body.style.cssText='margin:0;padding:0;background:#f9f7f1'
    const pinia=createPinia(),general=useGeneralStore(pinia),appStore=useAppStore(pinia),section=ref('themes')
    appStore.name='BongoCat Empire';appStore.version='1.8.1'
    general.appearance.language='en-US';i18n.global.locale.value='en-US'
    watch(()=>general.appearance.language,v=>{i18n.global.locale.value=v})
    createApp({setup(){return()=>h(Shell,{'modelValue':section.value,'nativeMac':true,'onUpdate:modelValue':v=>section.value=v,onLanguageChange:v=>general.appearance.language=v}, {default:()=>[
      h(Growth,{section:section.value}),h('div',{style:section.value==='settings'?'':'display:none'},[
        h(More,{}, {cat:()=>h(Cat),general:()=>h(General),model:()=>h(Model),about:()=>h(About),shortcut:()=>h('span','')})
      ])
    ]})}}).use(pinia).use(i18n).mount('#app')
    window.__qa={growth,general,i18n,section,nextTick}
    await growth.init();await growth.reset();await growth.updateSettings({autoCycle:false});await nextTick()
  },{growthURL:(await growthResponse).url(),componentURL:(await componentResponse).url()})
  await page.locator('.language-switch').waitFor()
  const snapshot=()=>page.evaluate(()=>JSON.stringify(window.__qa.growth.state.value))
  const original=await snapshot()
  async function language(value){await page.locator('.language-switch').selectOption(value);await page.evaluate(()=>window.__qa.nextTick());assert.equal(await page.evaluate(()=>window.__qa.general.appearance.language),value)}
  async function go(section){await page.locator(`.preference-navigation [data-section="${section}"]`).click();await page.locator(`[data-growth-section="${section}"]`).waitFor()}
  async function noChinese(label){
    const found=await page.evaluate(()=>{
      const out=[],walker=document.createTreeWalker(document.querySelector('.preference-content'),NodeFilter.SHOW_TEXT)
      while(walker.nextNode()){
        const n=walker.currentNode,p=n.parentElement
        if(!p||!p.getClientRects().length||p.closest('select,[role="option"]'))continue
        if(/[\p{Script=Han}]/u.test(n.textContent))out.push(n.textContent.trim())
      }
      return out
    });assert.deepEqual(found,[],`${label}: visible Chinese remains`);checks.push(label)
    const escaped=await page.locator('.theme-card,.outfit-card').evaluateAll(cards=>cards.flatMap((card,index)=>{
      const bounds=card.getBoundingClientRect()
      return [...card.querySelectorAll('strong,.theme-status,.outfit-caption')].filter(el=>{const rect=el.getBoundingClientRect();return rect.left<bounds.left-1||rect.right>bounds.right+1||rect.bottom>bounds.bottom+1}).map(el=>({index,text:el.textContent}))
    }))
    assert.deepEqual(escaped,[],`${label}: card text overflows`)
  }
  await noChinese('English theme overview')
  await page.screenshot({path:fileURLToPath(new URL('themes-en.png',output))})
  for(const id of ['wizard','astronaut','pirate','ninja','hero','wuxia','baker','garden','performer','cultivation','shaolin','emperor']){
    await page.locator(`button[data-theme="${id}"]`).click();assert.equal(await page.locator('.outfit-card').count(),9)
    await noChinese(`English ${id}: all nine levels`)
    await page.locator('[data-level="9"]').click()
    await noChinese(`English ${id}: level 9 dialog`)
    await page.locator('.preview-dialog .dialog-close').click()
    await page.locator('.back-to-themes').click()
  }
  for(const section of ['progress','thresholds','settings','backup']){await go(section);await noChinese(`English ${section}`)}
  await go('backup')
  for (const value of ['en-US','zh-CN']) {
    await language(value)
    await page.locator('input[type="file"]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')})
    assert.match(await page.locator('.alert-error').innerText(),value==='en-US'?/This backup is not valid JSON/:/备份不是有效的 JSON 文件/)
    checks.push(`Malformed backup has a clear ${value} error`)
  }
  await language('en-US')
  await go('settings')
  for(const setting of ['cat','general','model','about']){
    await page.locator(`[data-setting="${setting}"]`).click();await noChinese(`English settings: ${setting}`)
  }
  await page.locator('[data-setting="general"]').click()
  assert.match(await page.locator('.input-diagnostics').innerText(),/Input Monitoring permission is not active for this build/)
  await page.screenshot({path:fileURLToPath(new URL('settings-en.png',output))})
  await language('zh-CN')
  assert.match(await page.locator('.preference-titlebar').innerText(),/设置/)
  assert.match(await page.locator('.input-diagnostics').innerText(),/输入监控权限尚未对当前版本生效/)
  await page.screenshot({path:fileURLToPath(new URL('settings-zh.png',output))})
  await go('themes');await page.locator('button[data-theme="emperor"]').click()
  assert.match(await page.locator('.detail-heading').innerText(),/称帝/)
  await page.screenshot({path:fileURLToPath(new URL('emperor-zh.png',output))})
  await page.locator('[data-level="9"]').click();await page.evaluate(async()=>{window.__qa.general.appearance.language='en-US';await window.__qa.nextTick()})
  await noChinese('Open preview changes immediately to English')
  await page.screenshot({path:fileURLToPath(new URL('emperor-preview-en.png',output))})
  await page.locator('.preview-dialog .dialog-close').click()
  await go('thresholds')
  const inputs=page.locator('.threshold-grid input')
  await inputs.nth(1).fill('0')
  await noChinese('Invalid threshold validation in English')
  assert.match(await page.locator('.threshold-validation').innerText(),/LV2.*LV1/)
  await language('zh-CN');assert.match(await page.locator('.threshold-validation').innerText(),/必须大于/)
  await language('en-US');await noChinese('Validation switches back to English')
  assert.equal(await snapshot(),original,'Changing language or preview must not change growth, outfits, or thresholds')
  await page.setViewportSize({width:800,height:620})
  await page.screenshot({path:fileURLToPath(new URL('thresholds-en-minimum.png',output))})
  const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth>innerWidth,content:document.querySelector('.preference-content').scrollWidth>document.querySelector('.preference-content').clientWidth+1}))
  assert.deepEqual(overflow,{document:false,content:false})
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[])
  await writeFile(new URL('localization-qa.json',output),JSON.stringify({status:'pass',checkedAt:new Date().toISOString(),checks,errors,failures,minimumWindow:overflow,dataUnchanged:true,scope:'Actual production Vue components with browser-only growth data and mocked native diagnostic transport; native persistence and live input are verified separately.'},null,2)+'\n')
  console.log(JSON.stringify({status:'pass',checks:checks.length,errors,failures}))
}finally{await browser.close()}

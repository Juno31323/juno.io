const dirty=new Set<HTMLFormElement>();
document.querySelectorAll<HTMLFormElement>('form[data-track]').forEach(form=>form.addEventListener('input',()=>dirty.add(form)));
window.addEventListener('beforeunload',event=>{if(dirty.size)event.preventDefault();});
const message=(form:HTMLFormElement,text:string,error=false)=>{const el=form.querySelector<HTMLElement>('[data-feedback]');if(el){el.textContent=text;el.classList.toggle('error',error);}};
function syncTheme(){const form=document.querySelector<HTMLFormElement>('#theme-form');if(!form)return;const data=new FormData(form),rows=Array.from(form.querySelectorAll<HTMLElement>('[data-section]'));(form.elements.namedItem('theme')as HTMLInputElement).value=JSON.stringify({accent:data.get('accent'),mode:data.get('mode'),order:rows.map(row=>row.dataset.section),hidden:rows.filter(row=>!row.querySelector<HTMLInputElement>('input')!.checked).map(row=>row.dataset.section)});}
document.querySelector('#theme-form')?.addEventListener('input',syncTheme);
document.querySelectorAll<HTMLFormElement>('form[data-api]').forEach(form=>form.addEventListener('submit',async event=>{
  event.preventDefault();const action=form.dataset.api!,buttons=Array.from(form.querySelectorAll<HTMLButtonElement>('button[type=submit]'));
  if(form.getAttribute('aria-busy')==='true')return;
  if(action==='publish'&&dirty.size){message(form,'먼저 작성 중인 내용을 저장해 주세요. 게시에는 저장된 내용이 사용됩니다.',true);return;}
  if(form.dataset.confirm&&!confirm(form.dataset.confirm))return;
  if(action==='theme')syncTheme();
  if(action==='upload'&&form.dataset.multiple==='true'){const target=document.getElementById(form.dataset.uploadTarget!)as HTMLInputElement;if(target.value.split(',').filter(Boolean).length>=8){message(form,'프로젝트 이미지는 8개까지 선택할 수 있습니다.',true);return;}}
  buttons.forEach(b=>b.disabled=true);form.setAttribute('aria-busy','true');message(form,'처리 중입니다.');
  try{
    const response=await fetch(`/api/${action}/`,{method:'POST',body:new FormData(form),credentials:'same-origin'}),result=await response.json();
    if(!response.ok){message(form,result.error||'저장하지 못했습니다. 다시 시도해 주세요.',true);return;}
    dirty.delete(form);message(form,result.message||'저장했습니다.');
    if(result.profileVersion)document.querySelectorAll<HTMLInputElement>('[data-profile-version]').forEach(input=>input.value=result.profileVersion);
    if(result.version){const version=form.elements.namedItem('version')as HTMLInputElement|null;if(version)version.value=result.version;}
    if(result.shareUrl!==undefined){const input=document.querySelector<HTMLInputElement>('#share-url');if(input)input.value=result.shareUrl||'';}
    if(result.visibility){const labels:Record<string,string>={private:'비공개',link:'링크 공개',public:'공개'};const state=document.querySelector('#publication-state');if(state)state.textContent=labels[result.visibility];document.querySelectorAll<HTMLSelectElement>('select[name=visibility]').forEach(select=>select.value=result.visibility);}
    if(result.published){const controls=document.querySelector<HTMLElement>('[data-api=visibility]');if(controls)controls.hidden=false;}
    if(result.asset){
      const target=document.getElementById(form.dataset.uploadTarget!)as HTMLInputElement;
      const img=document.createElement('img');img.src=result.url;img.alt=result.asset.alt;img.width=144;img.height=96;
      const button=document.createElement('button');button.type='button';button.className='text-button';button.textContent='제외';
      if(form.dataset.multiple==='true'){target.value=[...target.value.split(',').filter(Boolean),result.asset.id].join(',');const li=document.createElement('li');li.dataset.asset=result.asset.id;button.dataset.removeImage=result.asset.id;li.append(img,button);document.querySelector('#image-selection')!.append(li);}
      else{target.value=result.asset.id;button.dataset.removePhoto='';const div=document.createElement('div');div.append(img,button);document.querySelector('#photo-selection')!.replaceChildren(div);}
      target.dispatchEvent(new Event('input',{bubbles:true}));form.reset();
    }
    if(result.preview)document.querySelectorAll<HTMLIFrameElement>('[data-live-preview]').forEach(frame=>{frame.src=`/dashboard/preview/?v=${Date.now()}`;});
    if(action==='signup')form.querySelector<HTMLInputElement>('[name=password]')!.value='';
    if(result.redirect){if(action==='delete-project')dirty.clear();location.assign(result.redirect);}
  }catch{message(form,'서버에 연결하지 못했습니다. 입력한 내용은 남아 있습니다. 다시 시도해 주세요.',true);}
  finally{form.removeAttribute('aria-busy');buttons.forEach(b=>b.disabled=false);}
}));
document.addEventListener('click',async event=>{
  const target=event.target instanceof Element?event.target:null;if(!target)return;
  const copy=target.closest<HTMLElement>('[data-copy-from]');if(copy){const input=document.getElementById(copy.dataset.copyFrom!)as HTMLInputElement;if(!input.value)return;const status=document.querySelector('#copy-status');try{await navigator.clipboard.writeText(input.value);if(status)status.textContent='주소를 복사했습니다.';}catch{input.focus();input.select();if(status)status.textContent='주소를 선택했습니다. 직접 복사해 주세요.';}}
  const move=target.closest<HTMLElement>('[data-move]');if(move){const item=move.closest<HTMLElement>('.order-item')!,parent=item.parentElement!,sibling=move.dataset.move==='up'?item.previousElementSibling:item.nextElementSibling;if(!sibling)return;if(move.dataset.move==='up')parent.insertBefore(item,sibling);else parent.insertBefore(sibling,item);const form=move.closest<HTMLFormElement>('form')!;dirty.add(form);const ids=form.elements.namedItem('ids')as HTMLInputElement|null;if(ids)ids.value=Array.from(parent.querySelectorAll<HTMLElement>('[data-id]')).map(el=>el.dataset.id).join(',');syncTheme();move.focus();}
  const remove=target.closest<HTMLElement>('[data-remove-image]');if(remove){const input=document.querySelector<HTMLInputElement>('#project-images')!;input.value=input.value.split(',').filter(id=>id!==remove.dataset.removeImage).join(',');remove.closest('li')?.remove();input.dispatchEvent(new Event('input',{bubbles:true}));}
  if(target.closest('[data-remove-photo]')){const input=document.querySelector<HTMLInputElement>('#photo-id')!;input.value='';document.querySelector('#photo-selection')!.replaceChildren();input.dispatchEvent(new Event('input',{bubbles:true}));}
  const size=target.closest<HTMLElement>('[data-preview-width]');if(size){document.querySelector<HTMLElement>('.preview-window')!.dataset.previewSize=size.dataset.previewWidth;document.querySelectorAll<HTMLElement>('[data-preview-width]').forEach(b=>b.setAttribute('aria-pressed',String(b===size)));sizePreview();}
});
function sizePreview(){const panel=document.querySelector<HTMLElement>('.preview-window'),frame=panel?.querySelector('iframe');if(!panel||!frame)return;const width=panel.dataset.previewSize==='mobile'?390:1280,scale=Math.min(1,(panel.clientWidth-24)/width);frame.style.width=`${width}px`;frame.style.height='1000px';frame.style.transform=`scale(${scale})`;frame.style.transformOrigin='top left';panel.style.height=`${Math.ceil(1000*scale)+24}px`;}
const preview=document.querySelector('.preview-window');if(preview){new ResizeObserver(sizePreview).observe(preview);sizePreview();}
if(location.pathname.startsWith('/s/'))window.addEventListener('pagehide',()=>document.querySelector('#main')?.replaceChildren());
if(location.pathname.startsWith('/s/')||location.pathname.startsWith('/dashboard/'))window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});

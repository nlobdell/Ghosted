(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,2351,55364,69510,74677,t=>{"use strict";let e;var r,i=t.i(57471),n=t.i(47760);let s=[];async function a(t){if(!t)for(let t=0;t<s.length;t++){let e=s[t];if(e.value.test())return void await e.value.load()}}n.extensions.handleByNamedList(n.ExtensionType.Environment,s);var o=t.i(50147);function l(){if("boolean"==typeof e)return e;try{let t=Function("param1","param2","param3","return param1[param2] === param3;");e=!0===t({a:"b"},"a","b")}catch(t){e=!1}return e}t.s(["unsafeEvalSupported",0,l],55364);var h=t.i(24314),u=t.i(49864),c=t.i(48446),d=((r=d||{})[r.NONE=0]="NONE",r[r.COLOR=16384]="COLOR",r[r.STENCIL=1024]="STENCIL",r[r.DEPTH=256]="DEPTH",r[r.COLOR_DEPTH=16640]="COLOR_DEPTH",r[r.COLOR_STENCIL=17408]="COLOR_STENCIL",r[r.DEPTH_STENCIL=1280]="DEPTH_STENCIL",r[r.ALL=17664]="ALL",r);t.s(["CLEAR",0,d],69510);class x{constructor(t){this.items=[],this._name=t}emit(t,e,r,i,n,s,a,o){let{name:l,items:h}=this;for(let u=0,c=h.length;u<c;u++)h[u][l](t,e,r,i,n,s,a,o);return this}add(t){return t[this._name]&&(this.remove(t),this.items.push(t)),this}remove(t){let e=this.items.indexOf(t);return -1!==e&&this.items.splice(e,1),this}contains(t){return -1!==this.items.indexOf(t)}removeAll(){return this.items.length=0,this}destroy(){this.removeAll(),this.items=null,this._name=null}get empty(){return 0===this.items.length}get name(){return this._name}}t.s(["SystemRunner",0,x],74677);var p=t.i(95932);let f=["init","destroy","contextChange","resolutionChange","resetState","renderEnd","renderStart","render","update","postrender","prerender"],m=class t extends p.default{constructor(t){super(),this.tick=0,this.uid=(0,h.uid)("renderer"),this.runners=Object.create(null),this.renderPipes=Object.create(null),this._initOptions={},this._systemsHash=Object.create(null),this.type=t.type,this.name=t.name,this.config=t;const e=[...f,...this.config.runners??[]];this._addRunners(...e),this._unsafeEvalCheck()}async init(e={}){let r=!0===e.skipExtensionImports||!1===e.manageImports;for(let t in await a(r),this._addSystems(this.config.systems),this._addPipes(this.config.renderPipes,this.config.renderPipeAdaptors),this._systemsHash)e={...this._systemsHash[t].constructor.defaultOptions,...e};e={...t.defaultOptions,...e},this._roundPixels=+!!e.roundPixels;for(let t=0;t<this.runners.init.items.length;t++)await this.runners.init.items[t].init(e);this._initOptions=e}render(t,e){this.tick++;let r=t;if(r instanceof o.Container&&(r={container:r},e&&((0,u.deprecation)(u.v8_0_0,"passing a second argument is deprecated, please use render options instead"),r.target=e.renderTexture)),r.target||(r.target=this.view.renderTarget),r.target===this.view.renderTarget&&(this._lastObjectRendered=r.container,r.clearColor??(r.clearColor=this.background.colorRgba),r.clear??(r.clear=this.background.clearBeforeRender)),r.clearColor){let t=Array.isArray(r.clearColor)&&4===r.clearColor.length;r.clearColor=t?r.clearColor:i.Color.shared.setValue(r.clearColor).toArray()}r.transform||(r.container.updateLocalTransform(),r.transform=r.container.localTransform),r.container.visible&&(r.container.enableRenderGroup(),this.runners.prerender.emit(r),this.runners.renderStart.emit(r),this.runners.render.emit(r),this.runners.renderEnd.emit(r),this.runners.postrender.emit(r))}resize(t,e,r){let i=this.view.resolution;this.view.resize(t,e,r),this.emit("resize",this.view.screen.width,this.view.screen.height,this.view.resolution),void 0!==r&&r!==i&&this.runners.resolutionChange.emit(r)}clear(t={}){t.target||(t.target=this.renderTarget.renderTarget),t.clearColor||(t.clearColor=this.background.colorRgba),t.clear??(t.clear=d.ALL);let{clear:e,clearColor:r,target:n,mipLevel:s,layer:a}=t;i.Color.shared.setValue(r??this.background.colorRgba),this.renderTarget.clear(n,e,i.Color.shared.toArray(),s??0,a??0)}get resolution(){return this.view.resolution}set resolution(t){this.view.resolution=t,this.runners.resolutionChange.emit(t)}get width(){return this.view.texture.frame.width}get height(){return this.view.texture.frame.height}get canvas(){return this.view.canvas}get lastObjectRendered(){return this._lastObjectRendered}get renderingToScreen(){return this.renderTarget.renderingToScreen}get screen(){return this.view.screen}_addRunners(...t){t.forEach(t=>{this.runners[t]=new x(t)})}_addSystems(t){let e;for(e in t){let r=t[e];this._addSystem(r.value,r.name)}}_addSystem(t,e){let r=new t(this);if(this[e])throw Error(`Whoops! The name "${e}" is already in use`);for(let t in this[e]=r,this._systemsHash[e]=r,this.runners)this.runners[t].add(r);return this}_addPipes(t,e){let r=e.reduce((t,e)=>(t[e.name]=e.value,t),{});t.forEach(t=>{let e=t.value,i=t.name,n=r[i];this.renderPipes[i]=new e(this,n?new n:null),this.runners.destroy.add(this.renderPipes[i])})}destroy(t=!1){this.runners.destroy.items.reverse(),this.runners.destroy.emit(t),(!0===t||"object"==typeof t&&t.releaseGlobalResources)&&c.GlobalResourceRegistry.release(),Object.values(this.runners).forEach(t=>{t.destroy()}),this._systemsHash=null,this.renderPipes=null,this.removeAllListeners()}generateTexture(t){return this.textureGenerator.generateTexture(t)}get roundPixels(){return!!this._roundPixels}_unsafeEvalCheck(){if(!l())throw Error("Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.")}resetState(){this.runners.resetState.emit()}};m.defaultOptions={resolution:1,failIfMajorPerformanceCaveat:!1,roundPixels:!1},t.s(["AbstractRenderer",0,m],2351)},81834,76789,t=>{"use strict";var e=t.i(47760);t.i(95932);let r="8.17.1";t.s(["VERSION",0,r],76789);class i{static init(){globalThis.__PIXI_APP_INIT__?.(this,r)}static destroy(){}}i.extension=e.ExtensionType.Application;class n{constructor(t){this._renderer=t}init(){globalThis.__PIXI_RENDERER_INIT__?.(this._renderer,r)}destroy(){this._renderer=null}}n.extension={type:[e.ExtensionType.WebGLSystem,e.ExtensionType.WebGPUSystem],name:"initHook",priority:-10},t.s(["ApplicationInitHook",0,i,"RendererInitHook",0,n],81834)},89506,t=>{"use strict";t.s(["color32BitToUniform",0,function(t,e,r){let i=(t>>24&255)/255;e[r++]=(255&t)/255*i,e[r++]=(t>>8&255)/255*i,e[r++]=(t>>16&255)/255*i,e[r++]=i}])},40766,t=>{"use strict";t.s(["BatchableSprite",0,class{constructor(){this.batcherName="default",this.topology="triangle-list",this.attributeSize=4,this.indexSize=6,this.packAsQuad=!0,this.roundPixels=0,this._attributeStart=0,this._batcher=null,this._batch=null}get blendMode(){return this.renderable.groupBlendMode}get color(){return this.renderable.groupColorAlpha}reset(){this.renderable=null,this.texture=null,this._batcher=null,this._batch=null,this.bounds=null}destroy(){this.reset()}}])},87323,18102,96108,28028,45284,t=>{"use strict";var e,r=t.i(24314);class i{constructor(t){"number"==typeof t?this.rawBinaryData=new ArrayBuffer(t):t instanceof Uint8Array?this.rawBinaryData=t.buffer:this.rawBinaryData=t,this.uint32View=new Uint32Array(this.rawBinaryData),this.float32View=new Float32Array(this.rawBinaryData),this.size=this.rawBinaryData.byteLength}get int8View(){return this._int8View||(this._int8View=new Int8Array(this.rawBinaryData)),this._int8View}get uint8View(){return this._uint8View||(this._uint8View=new Uint8Array(this.rawBinaryData)),this._uint8View}get int16View(){return this._int16View||(this._int16View=new Int16Array(this.rawBinaryData)),this._int16View}get int32View(){return this._int32View||(this._int32View=new Int32Array(this.rawBinaryData)),this._int32View}get float64View(){return this._float64Array||(this._float64Array=new Float64Array(this.rawBinaryData)),this._float64Array}get bigUint64View(){return this._bigUint64Array||(this._bigUint64Array=new BigUint64Array(this.rawBinaryData)),this._bigUint64Array}view(t){return this[`${t}View`]}destroy(){this.rawBinaryData=null,this.uint32View=null,this.float32View=null,this.uint16View=null,this._int8View=null,this._uint8View=null,this._int16View=null,this._int32View=null,this._float64Array=null,this._bigUint64Array=null}static sizeOf(t){switch(t){case"int8":case"uint8":return 1;case"int16":case"uint16":return 2;case"int32":case"uint32":case"float32":return 4;default:throw Error(`${t} isn't a valid view type`)}}}var n=t.i(49864),s=t.i(48446);function a(t,e,r,i){if(r??(r=0),i??(i=Math.min(t.byteLength-r,e.byteLength)),7&r||7&i)if(3&r||3&i)new Uint8Array(e).set(new Uint8Array(t,r,i));else{let n=i/4;new Float32Array(e,0,n).set(new Float32Array(t,r,n))}else{let n=i/8;new Float64Array(e,0,n).set(new Float64Array(t,r,n))}}t.s(["fastCopy",0,a],18102);let o={normal:"normal-npm",add:"add-npm",screen:"screen-npm"};var l=((e=l||{})[e.DISABLED=0]="DISABLED",e[e.RENDERING_MASK_ADD=1]="RENDERING_MASK_ADD",e[e.MASK_ACTIVE=2]="MASK_ACTIVE",e[e.INVERSE_MASK_ACTIVE=3]="INVERSE_MASK_ACTIVE",e[e.RENDERING_MASK_REMOVE=4]="RENDERING_MASK_REMOVE",e[e.NONE=5]="NONE",e);function h(t,e){return"no-premultiply-alpha"===e.alphaMode&&o[t]||t}t.s(["BLEND_TO_NPM",0,o,"STENCIL_MODES",0,l],96108);var u=t.i(29281);function c(t,e){if(0===t)throw Error("Invalid value of `0` passed to `checkMaxIfStatementsInShader`");let r=e.createShader(e.FRAGMENT_SHADER);try{for(;;){let i="precision mediump float;\nvoid main(void){\nfloat test = 0.1;\n%forloop%\ngl_FragColor = vec4(0.0);\n}".replace(/%forloop%/gi,function(t){let e="";for(let r=0;r<t;++r)r>0&&(e+="\nelse "),r<t-1&&(e+=`if(test == ${r}.0){}`);return e}(t));if(e.shaderSource(r,i),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS))break;t=t/2|0}}finally{e.deleteShader(r)}return t}t.s(["checkMaxIfStatementsInShader",0,c],28028);let d=null;class x{constructor(){this.ids=Object.create(null),this.textures=[],this.count=0}clear(){for(let t=0;t<this.count;t++){let e=this.textures[t];this.textures[t]=null,this.ids[e.uid]=null}this.count=0}}class p{constructor(){this.renderPipeId="batch",this.action="startBatch",this.start=0,this.size=0,this.textures=new x,this.blendMode="normal",this.topology="triangle-strip",this.canBundle=!0}destroy(){this.textures=null,this.gpuBindGroup=null,this.bindGroup=null,this.batcher=null,this.elements=null}}let f=[],m=0;function _(){return m>0?f[--m]:new p}function g(t){t.elements=null,f[m++]=t}s.GlobalResourceRegistry.register({clear:()=>{if(f.length>0)for(let t of f)t&&t.destroy();f.length=0,m=0}});let b=0,v=class t{constructor(e){this.uid=(0,r.uid)("batcher"),this.dirty=!0,this.batchIndex=0,this.batches=[],this._elements=[],(e={...t.defaultOptions,...e}).maxTextures||((0,n.deprecation)("v8.8.0","maxTextures is a required option for Batcher now, please pass it in the options"),e.maxTextures=function(){if(d)return d;let t=(0,u.getTestContext)();return d=c(d=t.getParameter(t.MAX_TEXTURE_IMAGE_UNITS),t),t.getExtension("WEBGL_lose_context")?.loseContext(),d}());const{maxTextures:s,attributesInitialSize:a,indicesInitialSize:o}=e;this.attributeBuffer=new i(4*a),this.indexBuffer=new Uint16Array(o),this.maxTextures=s}begin(){this.elementSize=0,this.elementStart=0,this.indexSize=0,this.attributeSize=0;for(let t=0;t<this.batchIndex;t++)g(this.batches[t]);this.batchIndex=0,this._batchIndexStart=0,this._batchIndexSize=0,this.dirty=!0}add(t){this._elements[this.elementSize++]=t,t._indexStart=this.indexSize,t._attributeStart=this.attributeSize,t._batcher=this,this.indexSize+=t.indexSize,this.attributeSize+=t.attributeSize*this.vertexSize}checkAndUpdateTexture(t,e){let r=t._batch.textures.ids[e._source.uid];return(!!r||0===r)&&(t._textureId=r,t.texture=e,!0)}updateElement(t){this.dirty=!0;let e=this.attributeBuffer;t.packAsQuad?this.packQuadAttributes(t,e.float32View,e.uint32View,t._attributeStart,t._textureId):this.packAttributes(t,e.float32View,e.uint32View,t._attributeStart,t._textureId)}break(t){let e=this._elements;if(!e[this.elementStart])return;let r=_(),i=r.textures;i.clear();let n=e[this.elementStart],s=h(n.blendMode,n.texture._source),a=n.topology;4*this.attributeSize>this.attributeBuffer.size&&this._resizeAttributeBuffer(4*this.attributeSize),this.indexSize>this.indexBuffer.length&&this._resizeIndexBuffer(this.indexSize);let o=this.attributeBuffer.float32View,l=this.attributeBuffer.uint32View,u=this.indexBuffer,c=this._batchIndexSize,d=this._batchIndexStart,x="startBatch",p=[],f=this.maxTextures;for(let n=this.elementStart;n<this.elementSize;++n){let m=e[n];e[n]=null;let g=m.texture._source,v=h(m.blendMode,g),y=s!==v||a!==m.topology;if(g._batchTick===b&&!y){m._textureId=g._textureBindLocation,c+=m.indexSize,m.packAsQuad?(this.packQuadAttributes(m,o,l,m._attributeStart,m._textureId),this.packQuadIndex(u,m._indexStart,m._attributeStart/this.vertexSize)):(this.packAttributes(m,o,l,m._attributeStart,m._textureId),this.packIndex(m,u,m._indexStart,m._attributeStart/this.vertexSize)),m._batch=r,p.push(m);continue}g._batchTick=b,(i.count>=f||y)&&(this._finishBatch(r,d,c-d,i,s,a,t,x,p),x="renderBatch",d=c,s=v,a=m.topology,(i=(r=_()).textures).clear(),p=[],++b),m._textureId=g._textureBindLocation=i.count,i.ids[g.uid]=i.count,i.textures[i.count++]=g,m._batch=r,p.push(m),c+=m.indexSize,m.packAsQuad?(this.packQuadAttributes(m,o,l,m._attributeStart,m._textureId),this.packQuadIndex(u,m._indexStart,m._attributeStart/this.vertexSize)):(this.packAttributes(m,o,l,m._attributeStart,m._textureId),this.packIndex(m,u,m._indexStart,m._attributeStart/this.vertexSize))}i.count>0&&(this._finishBatch(r,d,c-d,i,s,a,t,x,p),d=c,++b),this.elementStart=this.elementSize,this._batchIndexStart=d,this._batchIndexSize=c}_finishBatch(t,e,r,i,n,s,a,o,l){t.gpuBindGroup=null,t.bindGroup=null,t.action=o,t.batcher=this,t.textures=i,t.blendMode=n,t.topology=s,t.start=e,t.size=r,t.elements=l,++b,this.batches[this.batchIndex++]=t,a.add(t)}finish(t){this.break(t)}ensureAttributeBuffer(t){4*t<=this.attributeBuffer.size||this._resizeAttributeBuffer(4*t)}ensureIndexBuffer(t){t<=this.indexBuffer.length||this._resizeIndexBuffer(t)}_resizeAttributeBuffer(t){let e=new i(Math.max(t,2*this.attributeBuffer.size));a(this.attributeBuffer.rawBinaryData,e.rawBinaryData),this.attributeBuffer=e}_resizeIndexBuffer(t){let e=this.indexBuffer,r=Math.max(t,1.5*e.length);r+=r%2;let i=r>65535?new Uint32Array(r):new Uint16Array(r);if(i.BYTES_PER_ELEMENT!==e.BYTES_PER_ELEMENT)for(let t=0;t<e.length;t++)i[t]=e[t];else a(e.buffer,i.buffer);this.indexBuffer=i}packQuadIndex(t,e,r){t[e]=r+0,t[e+1]=r+1,t[e+2]=r+2,t[e+3]=r+0,t[e+4]=r+2,t[e+5]=r+3}packIndex(t,e,r,i){let n=t.indices,s=t.indexSize,a=t.indexOffset,o=t.attributeOffset;for(let t=0;t<s;t++)e[r++]=i+n[t+a]-o}destroy(t={}){if(null!==this.batches){for(let t=0;t<this.batchIndex;t++)g(this.batches[t]);this.batches=null,this.geometry.destroy(!0),this.geometry=null,t.shader&&(this.shader?.destroy(),this.shader=null);for(let t=0;t<this._elements.length;t++)this._elements[t]&&(this._elements[t]._batch=null);this._elements=null,this.indexBuffer=null,this.attributeBuffer.destroy(),this.attributeBuffer=null}}};v.defaultOptions={maxTextures:null,attributesInitialSize:4,indicesInitialSize:6},t.s(["Batcher",0,v],87323);var y=t.i(85465),C=t.i(64957),S=t.i(60406);let w=new Float32Array(1),T=new Uint32Array(1);class P extends S.Geometry{constructor(){const t=new y.Buffer({data:w,label:"attribute-batch-buffer",usage:C.BufferUsage.VERTEX|C.BufferUsage.COPY_DST,shrinkToFit:!1});super({attributes:{aPosition:{buffer:t,format:"float32x2",stride:24,offset:0},aUV:{buffer:t,format:"float32x2",stride:24,offset:8},aColor:{buffer:t,format:"unorm8x4",stride:24,offset:16},aTextureIdAndRound:{buffer:t,format:"uint16x2",stride:24,offset:20}},indexBuffer:new y.Buffer({data:T,label:"index-batch-buffer",usage:C.BufferUsage.INDEX|C.BufferUsage.COPY_DST,shrinkToFit:!1})})}}t.s(["BatchGeometry",0,P],45284)},81491,68372,94111,55443,t=>{"use strict";var e=t.i(81107),r=t.i(27076),i=t.i(85830);function n(t,e,r){if(t)for(let n in t){let s=e[n.toLocaleLowerCase()];if(s){let e=t[n];"header"===n&&(e=e.replace(/@in\s+[^;]+;\s*/g,"").replace(/@out\s+[^;]+;\s*/g,"")),r&&s.push(`//----${r}----//`),s.push(e)}else(0,i.warn)(`${n} placement hook does not exist in shader`)}}let s=/\{\{(.*?)\}\}/g;function a(t){let e={};return(t.match(s)?.map(t=>t.replace(/[{()}]/g,""))??[]).forEach(t=>{e[t]=[]}),e}function o(t,e){let r,i=/@in\s+([^;]+);/g;for(;null!==(r=i.exec(t));)e.push(r[1])}function l(t,e,r=!1){let i=[];o(e,i),t.forEach(t=>{t.header&&o(t.header,i)}),r&&i.sort();let n=i.map((t,e)=>`       @location(${e}) ${t},`).join("\n"),s=e.replace(/@in\s+[^;]+;\s*/g,"");return s.replace("{{in}}",`
${n}
`)}function h(t,e){let r,i=/@out\s+([^;]+);/g;for(;null!==(r=i.exec(t));)e.push(r[1])}function u(t,e){let r=t;for(let t in e){let i=e[t];r=i.join("\n").length?r.replace(`{{${t}}}`,`//-----${t} START-----//
${i.join("\n")}
//----${t} FINISH----//`):r.replace(`{{${t}}}`,"")}return r}let c=Object.create(null),d=new Map,x=0;function p(t,e){return e.map(t=>(d.has(t)||d.set(t,x++),d.get(t))).sort((t,e)=>t-e).join("-")+t.vertex+t.fragment}function f(t,e,r){let i=a(t),s=a(e);return r.forEach(t=>{n(t.vertex,i,t.name),n(t.fragment,s,t.name)}),{vertex:u(t,i),fragment:u(e,s)}}let m=`
    @in aPosition: vec2<f32>;
    @in aUV: vec2<f32>;

    @out @builtin(position) vPosition: vec4<f32>;
    @out vUV : vec2<f32>;
    @out vColor : vec4<f32>;

    {{header}}

    struct VSOutput {
        {{struct}}
    };

    @vertex
    fn main( {{in}} ) -> VSOutput {

        var worldTransformMatrix = globalUniforms.uWorldTransformMatrix;
        var modelMatrix = mat3x3<f32>(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
          );
        var position = aPosition;
        var uv = aUV;

        {{start}}

        vColor = vec4<f32>(1., 1., 1., 1.);

        {{main}}

        vUV = uv;

        var modelViewProjectionMatrix = globalUniforms.uProjectionMatrix * worldTransformMatrix * modelMatrix;

        vPosition =  vec4<f32>((modelViewProjectionMatrix *  vec3<f32>(position, 1.0)).xy, 0.0, 1.0);

        vColor *= globalUniforms.uWorldColorAlpha;

        {{end}}

        {{return}}
    };
`,_=`
    @in vUV : vec2<f32>;
    @in vColor : vec4<f32>;

    {{header}}

    @fragment
    fn main(
        {{in}}
      ) -> @location(0) vec4<f32> {

        {{start}}

        var outColor:vec4<f32>;

        {{main}}

        var finalColor:vec4<f32> = outColor * vColor;

        {{end}}

        return finalColor;
      };
`,g=`
    in vec2 aPosition;
    in vec2 aUV;

    out vec4 vColor;
    out vec2 vUV;

    {{header}}

    void main(void){

        mat3 worldTransformMatrix = uWorldTransformMatrix;
        mat3 modelMatrix = mat3(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
          );
        vec2 position = aPosition;
        vec2 uv = aUV;

        {{start}}

        vColor = vec4(1.);

        {{main}}

        vUV = uv;

        mat3 modelViewProjectionMatrix = uProjectionMatrix * worldTransformMatrix * modelMatrix;

        gl_Position = vec4((modelViewProjectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);

        vColor *= uWorldColorAlpha;

        {{end}}
    }
`,b=`

    in vec4 vColor;
    in vec2 vUV;

    out vec4 finalColor;

    {{header}}

    void main(void) {

        {{start}}

        vec4 outColor;

        {{main}}

        finalColor = outColor * vColor;

        {{end}}
    }
`,v={name:"global-uniforms-bit",vertex:{header:`
        struct GlobalUniforms {
            uProjectionMatrix:mat3x3<f32>,
            uWorldTransformMatrix:mat3x3<f32>,
            uWorldColorAlpha: vec4<f32>,
            uResolution: vec2<f32>,
        }

        @group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
        `}},y={name:"global-uniforms-bit",vertex:{header:`
          uniform mat3 uProjectionMatrix;
          uniform mat3 uWorldTransformMatrix;
          uniform vec4 uWorldColorAlpha;
          uniform vec2 uResolution;
        `}};t.s(["compileHighShaderGlProgram",0,function({bits:t,name:r}){return new e.GlProgram({name:r,...function({template:t,bits:e}){let r=p(t,e);return c[r]||(c[r]=f(t.vertex,t.fragment,e)),c[r]}({template:{vertex:g,fragment:b},bits:[y,...t]})})},"compileHighShaderGpuProgram",0,function({bits:t,name:e}){let i=function({template:t,bits:e}){let r=p(t,e);if(c[r])return c[r];let{vertex:i,fragment:n}=function(t,e){var r;let i,n,s,a,o,u=e.map(t=>t.vertex).filter(t=>!!t),c=e.map(t=>t.fragment).filter(t=>!!t),d=l(u,t.vertex,!0);return i=[],h(r=d,i),u.forEach(t=>{t.header&&h(t.header,i)}),n=0,s=i.sort().map(t=>t.indexOf("builtin")>-1?t:`@location(${n++}) ${t}`).join(",\n"),a=i.sort().map(t=>`       var ${t.replace(/@.*?\s+/g,"")};`).join("\n"),o=`return VSOutput(
            ${i.sort().map(t=>{let e;return` ${(e=/\b(\w+)\s*:/g.exec(t))?e[1]:""}`}).join(",\n")});`,{vertex:d=r.replace(/@out\s+[^;]+;\s*/g,"").replace("{{struct}}",`
${s}
`).replace("{{start}}",`
${a}
`).replace("{{return}}",`
${o}
`),fragment:l(c,t.fragment,!0)}}(t,e);return c[r]=f(i,n,e),c[r]}({template:{fragment:_,vertex:m},bits:[v,...t]});return r.GpuProgram.from({name:e,vertex:{source:i.vertex,entryPoint:"main"},fragment:{source:i.fragment,entryPoint:"main"}})}],81491);let C={name:"color-bit",vertex:{header:`
            @in aColor: vec4<f32>;
        `,main:`
            vColor *= vec4<f32>(aColor.rgb * aColor.a, aColor.a);
        `}},S={name:"color-bit",vertex:{header:`
            in vec4 aColor;
        `,main:`
            vColor *= vec4(aColor.rgb * aColor.a, aColor.a);
        `}};t.s(["colorBit",0,C,"colorBitGl",0,S],68372);let w={},T={};t.s(["generateTextureBatchBit",0,function(t){return w[t]||(w[t]={name:"texture-batch-bit",vertex:{header:`
                @in aTextureIdAndRound: vec2<u32>;
                @out @interpolate(flat) vTextureId : u32;
            `,main:`
                vTextureId = aTextureIdAndRound.y;
            `,end:`
                if(aTextureIdAndRound.x == 1)
                {
                    vPosition = vec4<f32>(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
                }
            `},fragment:{header:`
                @in @interpolate(flat) vTextureId: u32;

                ${function(t){let e=[];if(1===t)e.push("@group(1) @binding(0) var textureSource1: texture_2d<f32>;"),e.push("@group(1) @binding(1) var textureSampler1: sampler;");else{let r=0;for(let i=0;i<t;i++)e.push(`@group(1) @binding(${r++}) var textureSource${i+1}: texture_2d<f32>;`),e.push(`@group(1) @binding(${r++}) var textureSampler${i+1}: sampler;`)}return e.join("\n")}(t)}
            `,main:`
                var uvDx = dpdx(vUV);
                var uvDy = dpdy(vUV);

                ${function(t){let e=[];if(1===t)e.push("outColor = textureSampleGrad(textureSource1, textureSampler1, vUV, uvDx, uvDy);");else{e.push("switch vTextureId {");for(let r=0;r<t;r++)r===t-1?e.push("  default:{"):e.push(`  case ${r}:{`),e.push(`      outColor = textureSampleGrad(textureSource${r+1}, textureSampler${r+1}, vUV, uvDx, uvDy);`),e.push("      break;}");e.push("}")}return e.join("\n")}(t)}
            `}}),w[t]},"generateTextureBatchBitGl",0,function(t){return T[t]||(T[t]={name:"texture-batch-bit",vertex:{header:`
                in vec2 aTextureIdAndRound;
                out float vTextureId;

            `,main:`
                vTextureId = aTextureIdAndRound.y;
            `,end:`
                if(aTextureIdAndRound.x == 1.)
                {
                    gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
                }
            `},fragment:{header:`
                in float vTextureId;

                uniform sampler2D uTextures[${t}];

            `,main:`

                ${function(t){let e=[];for(let r=0;r<t;r++)r>0&&e.push("else"),r<t-1&&e.push(`if(vTextureId < ${r}.5)`),e.push("{"),e.push(`	outColor = texture(uTextures[${r}], vUV);`),e.push("}");return e.join("\n")}(t)}
            `}}),T[t]}],94111);let P={name:"round-pixels-bit",vertex:{header:`
            fn roundPixels(position: vec2<f32>, targetSize: vec2<f32>) -> vec2<f32>
            {
                return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
            }
        `}},B={name:"round-pixels-bit",vertex:{header:`
            vec2 roundPixels(vec2 position, vec2 targetSize)
            {
                return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
            }
        `}};t.s(["roundPixelsBit",0,P,"roundPixelsBitGl",0,B],55443)},77953,t=>{"use strict";var e=t.i(32543);let r={};t.s(["getBatchSamplersUniformGroup",0,function(t){let i=r[t];if(i)return i;let n=new Int32Array(t);for(let e=0;e<t;e++)n[e]=e;return r[t]=new e.UniformGroup({uTextures:{value:n,type:"i32",size:t}},{isStatic:!0})}])},97828,33219,t=>{"use strict";var e=t.i(47760),r=t.i(87323),i=t.i(45284),n=t.i(81491),s=t.i(68372),a=t.i(94111),o=t.i(55443),l=t.i(77953),h=t.i(65654);class u extends h.Shader{constructor(t){super({glProgram:(0,n.compileHighShaderGlProgram)({name:"batch",bits:[s.colorBitGl,(0,a.generateTextureBatchBitGl)(t),o.roundPixelsBitGl]}),gpuProgram:(0,n.compileHighShaderGpuProgram)({name:"batch",bits:[s.colorBit,(0,a.generateTextureBatchBit)(t),o.roundPixelsBit]}),resources:{batchSamplers:(0,l.getBatchSamplersUniformGroup)(t)}}),this.maxTextures=t}}let c=null,d=class t extends r.Batcher{constructor(e){super(e),this.geometry=new i.BatchGeometry,this.name=t.extension.name,this.vertexSize=6,c??(c=new u(e.maxTextures)),this.shader=c}packAttributes(t,e,r,i,n){let s=n<<16|65535&t.roundPixels,a=t.transform,o=a.a,l=a.b,h=a.c,u=a.d,c=a.tx,d=a.ty,{positions:x,uvs:p}=t,f=t.color,m=t.attributeOffset,_=m+t.attributeSize;for(let t=m;t<_;t++){let n=2*t,a=x[n],m=x[n+1];e[i++]=o*a+h*m+c,e[i++]=u*m+l*a+d,e[i++]=p[n],e[i++]=p[n+1],r[i++]=f,r[i++]=s}}packQuadAttributes(t,e,r,i,n){let s=t.texture,a=t.transform,o=a.a,l=a.b,h=a.c,u=a.d,c=a.tx,d=a.ty,x=t.bounds,p=x.maxX,f=x.minX,m=x.maxY,_=x.minY,g=s.uvs,b=t.color,v=n<<16|65535&t.roundPixels;e[i+0]=o*f+h*_+c,e[i+1]=u*_+l*f+d,e[i+2]=g.x0,e[i+3]=g.y0,r[i+4]=b,r[i+5]=v,e[i+6]=o*p+h*_+c,e[i+7]=u*_+l*p+d,e[i+8]=g.x1,e[i+9]=g.y1,r[i+10]=b,r[i+11]=v,e[i+12]=o*p+h*m+c,e[i+13]=u*m+l*p+d,e[i+14]=g.x2,e[i+15]=g.y2,r[i+16]=b,r[i+17]=v,e[i+18]=o*f+h*m+c,e[i+19]=u*m+l*f+d,e[i+20]=g.x3,e[i+21]=g.y3,r[i+22]=b,r[i+23]=v}_updateMaxTextures(t){this.shader.maxTextures!==t&&(c=new u(t),this.shader=c)}destroy(){this.shader=null,super.destroy()}};d.extension={type:[e.ExtensionType.Batcher],name:"default"},t.s(["DefaultBatcher",0,d],97828),t.s(["GCManagedHash",0,class{constructor(t){this.items=Object.create(null);const{renderer:e,type:r,onUnload:i,priority:n,name:s}=t;this._renderer=e,e.gc.addResourceHash(this,"items",r,n??0),this._onUnload=i,this.name=s}add(t){return!this.items[t.uid]&&(this.items[t.uid]=t,t.once("unload",this.remove,this),t._gcLastUsed=this._renderer.gc.now,!0)}remove(t,...e){if(!this.items[t.uid])return;let r=t._gpuData[this._renderer.uid];r&&(this._onUnload?.(t,...e),r.destroy(),t._gpuData[this._renderer.uid]=null,this.items[t.uid]=null)}removeAll(...t){Object.values(this.items).forEach(e=>e&&this.remove(e,...t))}destroy(...t){this.removeAll(...t),this.items=Object.create(null),this._renderer=null,this._onUnload=null}}],33219)},68750,t=>{"use strict";var e=t.i(94359),r=t.i(31320);let i={};t.s(["getTextureBatchBindGroup",0,function(t,n,s){let a=0x811c9dc5;for(let e=0;e<n;e++)a^=t[e].uid,a=Math.imul(a,0x1000193)>>>0;return i[a]||function(t,n,s,a){let o={},l=0;for(let e=0;e<a;e++){let i=e<n?t[e]:r.Texture.EMPTY.source;o[l++]=i.source,o[l++]=i.style}let h=new e.BindGroup(o);return i[s]=h,h}(t,n,a,s)}])},81735,t=>{"use strict";var e=t.i(27402),r=t.i(61411),i=t.i(48446);let n=new class{constructor(t){this._canvasPool=Object.create(null),this.canvasOptions=t||{},this.enableFullScreen=!1}_createCanvasAndContext(t,r){let i=e.DOMAdapter.get().createCanvas();i.width=t,i.height=r;let n=i.getContext("2d");return{canvas:i,context:n}}getOptimalCanvasAndContext(t,e,i=1){t=Math.ceil(t*i-1e-6),e=Math.ceil(e*i-1e-6),t=(0,r.nextPow2)(t),e=(0,r.nextPow2)(e);let n=(t<<17)+(e<<1);this._canvasPool[n]||(this._canvasPool[n]=[]);let s=this._canvasPool[n].pop();return s||(s=this._createCanvasAndContext(t,e)),s}returnCanvasAndContext(t){let{width:e,height:r}=t.canvas,i=(e<<17)+(r<<1);t.context.resetTransform(),t.context.clearRect(0,0,e,r),this._canvasPool[i].push(t)}clear(){this._canvasPool={}}};i.GlobalResourceRegistry.register(n),t.s(["CanvasPool",0,n])},94425,t=>{"use strict";var e=t.i(49864),r=t.i(97377),i=t.i(20446),n=t.i(47760),s=t.i(30725),a=t.i(33219);class o{constructor(){this.isBatchable=!1}reset(){this.isBatchable=!1,this.context=null,this.graphicsData&&(this.graphicsData.destroy(),this.graphicsData=null)}destroy(){this.reset()}}class l{constructor(){this.instructions=new s.InstructionSet}init(){this.instructions.reset()}destroy(){this.instructions.destroy(),this.instructions=null}}let h=class t{constructor(t){this._renderer=t,this._managedContexts=new a.GCManagedHash({renderer:t,type:"resource",name:"graphicsContext"})}init(e){t.defaultOptions.bezierSmoothness=e?.bezierSmoothness??t.defaultOptions.bezierSmoothness}getContextRenderData(t){return this.getGpuContext(t).graphicsData||this._initContextRenderData(t)}updateGpuContext(t){let e=t._gpuData,r=!!e[this._renderer.uid],i=e[this._renderer.uid]||this._initContext(t);return(t.dirty||!r)&&(r&&i.reset(),i.isBatchable=!1,t.dirty=!1),i}getGpuContext(t){return t._gpuData[this._renderer.uid]||this._initContext(t)}_initContextRenderData(t){let e=new l;return this.getGpuContext(t).graphicsData=e,e.init(),e}_initContext(t){let e=new o;return e.context=t,t._gpuData[this._renderer.uid]=e,this._managedContexts.add(t),e}destroy(){this._managedContexts.destroy(),this._renderer=null}};h.extension={type:[n.ExtensionType.CanvasSystem],name:"graphicsContext"},h.defaultOptions={bezierSmoothness:.5};var u=t.i(22558);class c{constructor(t,e){this.state=u.State.for2d(),this.renderer=t,this._adaptor=e,this.renderer.runners.contextChange.add(this),this._managedGraphics=new a.GCManagedHash({renderer:t,type:"renderable",priority:-1,name:"graphics"})}contextChange(){this._adaptor.contextChange(this.renderer)}validateRenderable(t){return!1}addRenderable(t,e){this._managedGraphics.add(t),this.renderer.renderPipes.batch.break(e),e.add(t)}updateRenderable(t){}execute(t){t.isRenderable&&this._adaptor.execute(this,t)}destroy(){this._managedGraphics.destroy(),this.renderer=null,this._adaptor.destroy(),this._adaptor=null}}c.extension={type:[n.ExtensionType.CanvasPipes],name:"graphics"};var d=t.i(99166),x=t.i(74179),p=t.i(89506),f=t.i(1187);class m{constructor(){this.batches=[],this.batched=!1}destroy(){this.batches.forEach(t=>{x.BigPool.return(t)}),this.batches.length=0}}class _{constructor(t,e){this.state=u.State.for2d(),this.renderer=t,this._adaptor=e,this.renderer.runners.contextChange.add(this),this._managedGraphics=new a.GCManagedHash({renderer:t,type:"renderable",priority:-1,name:"graphics"})}contextChange(){this._adaptor.contextChange(this.renderer)}validateRenderable(t){let e=t.context,r=!!t._gpuData,i=this.renderer.graphicsContext.updateGpuContext(e);return!!i.isBatchable||r!==i.isBatchable}addRenderable(t,e){let r=this.renderer.graphicsContext.updateGpuContext(t.context);t.didViewUpdate&&this._rebuild(t),r.isBatchable?this._addToBatcher(t,e):(this.renderer.renderPipes.batch.break(e),e.add(t))}updateRenderable(t){let e=this._getGpuDataForRenderable(t).batches;for(let t=0;t<e.length;t++){let r=e[t];r._batcher.updateElement(r)}}execute(t){if(!t.isRenderable)return;let e=this.renderer,r=t.context;if(!e.graphicsContext.getGpuContext(r).batches.length)return;let i=r.customShader||this._adaptor.shader;this.state.blendMode=t.groupBlendMode;let n=i.resources.localUniforms.uniforms;n.uTransformMatrix=t.groupTransform,n.uRound=e._roundPixels|t._roundPixels,(0,p.color32BitToUniform)(t.groupColorAlpha,n.uColor,0),this._adaptor.execute(this,t)}_rebuild(t){let e=this._getGpuDataForRenderable(t),r=this.renderer.graphicsContext.updateGpuContext(t.context);e.destroy(),r.isBatchable&&this._updateBatchesForRenderable(t,e)}_addToBatcher(t,e){let r=this.renderer.renderPipes.batch,i=this._getGpuDataForRenderable(t).batches;for(let t=0;t<i.length;t++){let n=i[t];r.addToBatch(n,e)}}_getGpuDataForRenderable(t){return t._gpuData[this.renderer.uid]||this._initGpuDataForRenderable(t)}_initGpuDataForRenderable(t){let e=new m;return t._gpuData[this.renderer.uid]=e,this._managedGraphics.add(t),e}_updateBatchesForRenderable(t,e){let r=t.context,i=this.renderer.graphicsContext.getGpuContext(r),n=this.renderer._roundPixels|t._roundPixels;e.batches=i.batches.map(e=>{let r=x.BigPool.get(f.BatchableGraphics);return e.copyTo(r),r.renderable=t,r.roundPixels=n,r})}destroy(){this._managedGraphics.destroy(),this.renderer=null,this._adaptor.destroy(),this._adaptor=null,this.state=null}}_.extension={type:[n.ExtensionType.WebGLPipes,n.ExtensionType.WebGPUPipes],name:"graphics"},n.extensions.add(c),n.extensions.add(_),n.extensions.add(h),n.extensions.add(d.GraphicsContextSystem);class g extends r.ViewContainer{constructor(t){t instanceof i.GraphicsContext&&(t={context:t});const{context:e,roundPixels:r,...n}=t||{};super({label:"Graphics",...n}),this.renderPipeId="graphics",e?this.context=e:(this.context=this._ownedContext=new i.GraphicsContext,this.context.autoGarbageCollect=this.autoGarbageCollect),this.didViewUpdate=!0,this.allowChildren=!1,this.roundPixels=r??!1}set context(t){t!==this._context&&(this._context&&(this._context.off("update",this.onViewUpdate,this),this._context.off("unload",this.unload,this)),this._context=t,this._context.on("update",this.onViewUpdate,this),this._context.on("unload",this.unload,this),this.onViewUpdate())}get context(){return this._context}get bounds(){return this._context.bounds}updateBounds(){}containsPoint(t){return this._context.containsPoint(t)}destroy(t){this._ownedContext&&!t?this._ownedContext.destroy(t):(!0===t||t?.context===!0)&&this._context.destroy(t),this._ownedContext=null,this._context=null,super.destroy(t)}_onTouch(t){this._gcLastUsed=t,this._context._gcLastUsed=t}_callContextMethod(t,e){return this.context[t](...e),this}setFillStyle(...t){return this._callContextMethod("setFillStyle",t)}setStrokeStyle(...t){return this._callContextMethod("setStrokeStyle",t)}fill(...t){return this._callContextMethod("fill",t)}stroke(...t){return this._callContextMethod("stroke",t)}texture(...t){return this._callContextMethod("texture",t)}beginPath(){return this._callContextMethod("beginPath",[])}cut(){return this._callContextMethod("cut",[])}arc(...t){return this._callContextMethod("arc",t)}arcTo(...t){return this._callContextMethod("arcTo",t)}arcToSvg(...t){return this._callContextMethod("arcToSvg",t)}bezierCurveTo(...t){return this._callContextMethod("bezierCurveTo",t)}closePath(){return this._callContextMethod("closePath",[])}ellipse(...t){return this._callContextMethod("ellipse",t)}circle(...t){return this._callContextMethod("circle",t)}path(...t){return this._callContextMethod("path",t)}lineTo(...t){return this._callContextMethod("lineTo",t)}moveTo(...t){return this._callContextMethod("moveTo",t)}quadraticCurveTo(...t){return this._callContextMethod("quadraticCurveTo",t)}rect(...t){return this._callContextMethod("rect",t)}roundRect(...t){return this._callContextMethod("roundRect",t)}poly(...t){return this._callContextMethod("poly",t)}regularPoly(...t){return this._callContextMethod("regularPoly",t)}roundPoly(...t){return this._callContextMethod("roundPoly",t)}roundShape(...t){return this._callContextMethod("roundShape",t)}filletRect(...t){return this._callContextMethod("filletRect",t)}chamferRect(...t){return this._callContextMethod("chamferRect",t)}star(...t){return this._callContextMethod("star",t)}svg(...t){return this._callContextMethod("svg",t)}restore(...t){return this._callContextMethod("restore",t)}save(){return this._callContextMethod("save",[])}getTransform(){return this.context.getTransform()}resetTransform(){return this._callContextMethod("resetTransform",[])}rotateTransform(...t){return this._callContextMethod("rotate",t)}scaleTransform(...t){return this._callContextMethod("scale",t)}setTransform(...t){return this._callContextMethod("setTransform",t)}transform(...t){return this._callContextMethod("transform",t)}translateTransform(...t){return this._callContextMethod("translate",t)}clear(){return this._callContextMethod("clear",[])}get fillStyle(){return this._context.fillStyle}set fillStyle(t){this._context.fillStyle=t}get strokeStyle(){return this._context.strokeStyle}set strokeStyle(t){this._context.strokeStyle=t}clone(t=!1){return t?new g(this._context.clone()):(this._ownedContext=null,new g(this._context))}lineStyle(t,r,i){(0,e.deprecation)(e.v8_0_0,"Graphics#lineStyle is no longer needed. Use Graphics#setStrokeStyle to set the stroke style.");let n={};return t&&(n.width=t),r&&(n.color=r),i&&(n.alpha=i),this.context.strokeStyle=n,this}beginFill(t,r){(0,e.deprecation)(e.v8_0_0,"Graphics#beginFill is no longer needed. Use Graphics#fill to fill the shape with the desired style.");let i={};return void 0!==t&&(i.color=t),void 0!==r&&(i.alpha=r),this.context.fillStyle=i,this}endFill(){(0,e.deprecation)(e.v8_0_0,"Graphics#endFill is no longer needed. Use Graphics#fill to fill the shape with the desired style."),this.context.fill();let t=this.context.strokeStyle;return(t.width!==i.GraphicsContext.defaultStrokeStyle.width||t.color!==i.GraphicsContext.defaultStrokeStyle.color||t.alpha!==i.GraphicsContext.defaultStrokeStyle.alpha)&&this.context.stroke(),this}drawCircle(...t){return(0,e.deprecation)(e.v8_0_0,"Graphics#drawCircle has been renamed to Graphics#circle"),this._callContextMethod("circle",t)}drawEllipse(...t){return(0,e.deprecation)(e.v8_0_0,"Graphics#drawEllipse has been renamed to Graphics#ellipse"),this._callContextMethod("ellipse",t)}drawPolygon(...t){return(0,e.deprecation)(e.v8_0_0,"Graphics#drawPolygon has been renamed to Graphics#poly"),this._callContextMethod("poly",t)}drawRect(...t){return(0,e.deprecation)(e.v8_0_0,"Graphics#drawRect has been renamed to Graphics#rect"),this._callContextMethod("rect",t)}drawRoundedRect(...t){return(0,e.deprecation)(e.v8_0_0,"Graphics#drawRoundedRect has been renamed to Graphics#roundRect"),this._callContextMethod("roundRect",t)}drawStar(...t){return(0,e.deprecation)(e.v8_0_0,"Graphics#drawStar has been renamed to Graphics#star"),this._callContextMethod("star",t)}}t.s(["Graphics",0,g],94425)},86043,t=>{t.v(e=>Promise.all(["static/chunks/0bysbq3sy49aa.js","static/chunks/00x1122yi.vse.js"].map(e=>t.l(e))).then(()=>e(70003)))},62925,t=>{t.v(e=>Promise.all(["static/chunks/0kodzzb8x11x9.js"].map(e=>t.l(e))).then(()=>e(54608)))},35640,t=>{t.v(e=>Promise.all(["static/chunks/179jtqy~x365~.js","static/chunks/0trny4syumfg_.js"].map(e=>t.l(e))).then(()=>e(46377)))},99331,t=>{t.v(e=>Promise.all(["static/chunks/0po0nton0o061.js","static/chunks/0lpucy-9-kocc.js","static/chunks/0hj8w10gggjx1.js"].map(e=>t.l(e))).then(()=>e(984)))},53088,t=>{t.v(e=>Promise.all(["static/chunks/149nvs~lnbl_6.js","static/chunks/0lpucy-9-kocc.js","static/chunks/09vivv9o9_k-a.js"].map(e=>t.l(e))).then(()=>e(50703)))},72891,t=>{t.v(e=>Promise.all(["static/chunks/0~q90mfoevsuz.js"].map(e=>t.l(e))).then(()=>e(91678)))}]);
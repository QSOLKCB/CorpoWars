// SPDX-License-Identifier: Apache-2.0
// Test-only WebGL call model. It copies the live submitted Float32 values,
// records draw state, and counts API work. It is not a GPU timing model.
import assert from 'node:assert/strict';

export function modelCanvas({capture=false}={}) {
  const stats={storageCalls:0,storageBytes:0,uploadCalls:0,uploadedBytes:0,attributeCalls:0,drawCalls:0};
  const buffers=new Set(),vaos=new Set(),uniforms=new Map();
  let bound=null,vao=null,depth=true,mask=true,next=0;
  const defaultVao={attributes:new Map()},draws=[];
  const gl={
    ARRAY_BUFFER:1,STATIC_DRAW:2,DYNAMIC_DRAW:3,VERTEX_SHADER:4,FRAGMENT_SHADER:5,
    COMPILE_STATUS:6,LINK_STATUS:7,FLOAT:8,TRIANGLES:9,DEPTH_TEST:10,LEQUAL:11,
    BLEND:12,SRC_ALPHA:13,ONE_MINUS_SRC_ALPHA:14,COLOR_BUFFER_BIT:16,DEPTH_BUFFER_BIT:32,
    createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
    deleteShader(){},createProgram:()=>({}),attachShader(){},linkProgram(){},deleteProgram(){},
    getProgramParameter:()=>true,getAttribLocation:(_,name)=>name==='a_position'?0:1,
    getUniformLocation:(_,name)=>name,useProgram(){},
    createBuffer(){const b={id:next++,data:new Float32Array(0)};buffers.add(b);return b;},
    bindBuffer(_,b){bound=b;},
    bufferData(_,data){assert.ok(buffers.has(bound));bound.data=typeof data==='number'?new Float32Array(data/4):new Float32Array(data);stats.storageCalls++;stats.storageBytes+=bound.data.byteLength;},
    bufferSubData(_,offset,data){assert.ok(bound&&offset+data.byteLength<=bound.data.byteLength,'GPU write exceeds retained storage');bound.data.set(data,offset/4);stats.uploadCalls++;stats.uploadedBytes+=data.byteLength;},
    deleteBuffer(b){buffers.delete(b);},
    createVertexArray(){const v={attributes:new Map()};vaos.add(v);return v;},
    bindVertexArray(v){vao=v;},deleteVertexArray(v){vaos.delete(v);},
    enableVertexAttribArray(){},
    vertexAttribPointer(index,size,type,normal,stride,offset){(vao??defaultVao).attributes.set(index,{buffer:bound,size,stride,offset});stats.attributeCalls++;},
    enable(flag){if(flag===this.DEPTH_TEST)depth=true;},disable(flag){if(flag===this.DEPTH_TEST)depth=false;},
    depthFunc(){},blendFunc(){},depthMask(value){mask=value;},clearColor(){},clear(){},viewport(){},
    uniform2f(loc,a,b){uniforms.set(loc,[a,b]);},uniform1f(loc,value){uniforms.set(loc,[value]);},
    drawArrays(mode,start,count){
      stats.drawCalls++;
      if(!capture)return;
      const attributes=(vao??defaultVao).attributes,pos=attributes.get(0),col=attributes.get(1);
      assert.ok(pos&&col,'position and colour attributes must be bound');
      assert.equal(pos.buffer,col.buffer);assert.equal(pos.stride,28);assert.equal(col.stride,28);
      const values=pos.buffer.data.slice(start*7,(start+count)*7);
      assert.equal(values.length,count*7,'draw exceeds uploaded capacity');
      draws.push({mode,count,depth,mask,uniforms:Object.fromEntries(uniforms),values});
    },
  };
  const rect={width:1280,height:720};
  const canvas={width:0,height:0,getContext:()=>gl,getBoundingClientRect:()=>rect};
  return {canvas,gl,stats,draws,rect,retainedBytes:()=>[...buffers].reduce((sum,b)=>sum+b.data.byteLength,0),liveBuffers:()=>buffers.size,liveVaos:()=>vaos.size};
}

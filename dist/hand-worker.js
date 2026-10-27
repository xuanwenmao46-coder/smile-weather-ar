let detector;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      // The bundled WASM loader uses importScripts, so keep this Worker classic.
      const {HandLandmarker,FilesetResolver}=await import('./vendor/mediapipe/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',self.location.href).href);
      detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/hand_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.6});
      self.postMessage({type:'ready'});
    }catch(error){self.postMessage({type:'error',message:String(error.message||error)});}
    return;
  }
  if(data.type==='frame'){
    try{
      if(!detector)throw Error('Hand detector not ready');
      const result=detector.detectForVideo(data.bitmap,data.now);
      self.postMessage({type:'result',points:result.landmarks?.[0]||null,now:data.now});
    }catch(error){self.postMessage({type:'error',message:String(error.message||error)});}
    finally{data.bitmap?.close();}
  }
};

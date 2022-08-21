// GoSpooky
// Max van Leeuwen
//
// Cinematic Glow

// To make glows 'white hot' at the core instead of a solid color, reduce the glow saturation.
// View the 'Glow Matte Target' in the Scene Config Panel for a reference of what's being glowed!



//@ui {"widget":"label", "label":"Cinematic Glow"}
//@ui {"widget":"label", "label":"by GoSpooky"}
//@ui {"widget":"label", "label":""}
//@ui {"widget":"label", "label":"1. Create a new Render Target and view it in the Scene Config panel"}
//@ui {"widget":"label", "label":"2. Assign that Render Target in this script under 'Composite Target'"}
//@ui {"widget":"label", "label":"3. Assign the camera that renders your scene to 'Main Camera'"}
//@ui {"widget":"label", "label":""}

//@input bool doNotGlow {"hint":"If you want to keep the glowing setup in your scene but you do not want to have it active now, enable this checkbox. This will directly 'reroute' the Main Camera's Render Target to the Composite Target."}
//@ui {"widget":"label", "label":""}

//@input Asset.Texture compositeTarget
//@input Component.Camera mainCamera
//@input bool warnPostEffects = true {"hint":"Post Effects can cause issues and need a custom fix to work. Enable this checkbox to get a message in the console when a fix is required."}
//@ui {"widget":"label", "label":""}

//@input bool showHidden
//@input Asset.Texture glowMatteTarget {"showIf":"showHidden"}
//@input Asset.Material cinematicGlowRenderer {"showIf":"showHidden"}
//@input Asset.Material glowOccluder {"showIf":"showHidden"}
//@input Asset.Material glowExample {"showIf":"showHidden"}
//@input bool customRenderOrder {"showIf":"showHidden", "hint":"If disabled, the glow's camera render order will be -100 by default."}
//@input int glowRenderOrder = -100 {"showIf":"customRenderOrder"}



const title = "[Cinematic Glow]\n";
const DEFAULT_RENDER_ORDER = -100;
var allRenderTargetLayers; // placeholder for all layers rendered for the active Render Target
var allCameras = []; // placeholder for all found camera components



// initialize camera
function init(){
    if(!script.compositeTarget) throw title + "1. Create a new Render Target and view it in the Scene Config panel.\nThis will be the final Live/Capture Render Target of a lens + glow.\n\n2. Assign that Render Target in this script under 'Composite Target'."; // check if new final render target is given
    if(!script.mainCamera) throw title + "Please assign the Main Camera (which is rendering the scene) to the Cinematic Glow script!"; // check if camera is given
    if(!script.mainCamera.renderTarget) throw title + "Please assign a Render Target to the chosen Main Camera! Camera SceneObject name: " + script.mainCamera.getSceneObject().name; // check if camera has out render target for use in composite

    var compositeLayer = LayerSet.makeUnique(); // make unique layer for glow composite
    var compositeCamera = script.getSceneObject().createComponent("Component.Camera");
    compositeCamera.type = Camera.Type.Orthographic;
    compositeCamera.renderLayer = compositeLayer;
    compositeCamera.enableClearColor = true;
    compositeCamera.inputTexture = script.mainCamera.renderTarget; // set input to composite camera
    compositeCamera.renderTarget = script.compositeTarget; // set render target to composite camera (if the default composite target was not deleted by the user yet)
    compositeCamera.renderOrder = script.customRenderOrder ? script.glowRenderOrder : DEFAULT_RENDER_ORDER; // set render order (custom, or default value)

    // if not glowing, let this camera reroute Main Camera's Render Target to the composite by stopping here
    if(script.doNotGlow) return;

    if(!script.glowMatteTarget) throw title + "Glow Matte Target not found - it seems like it was deleted"; // check glow matte target
    if(!script.cinematicGlowRenderer) throw title + "Cinematic Glow Renderer material not found - it seems like it was deleted"; // check glow material

    // make image component for glow composite
    var imageObj = global.scene.createSceneObject("Glow Composite");
    imageObj.setParent(script.getSceneObject());
    imageObj.layer = compositeLayer;
    var imageTrf = imageObj.createComponent("Component.ScreenTransform");
    imageTrf.anchors = Rect.create(-1, 1, -1, 1);
    imageTrf.position = new vec3(0, 0, -40);
    imageTrf.offsets = Rect.create(0, 0, 0, 0);
    var imageComponent = imageObj.createComponent("Component.Image");
    imageComponent.stretchMode = StretchMode.Stretch;
    imageComponent.addMaterial(script.cinematicGlowRenderer);
    script.cinematicGlowRenderer.mainPass.glowTexture = script.glowMatteTarget; // set glow matte target

    // make extra color target for other Cameras in same Render Target to prevent overwriting the color pass
    if(allCameras.length === 0) allCameras = getAllCameras().foundCameras; // if not searched for cameras yet, do it now
    for(var i = 0; i < allCameras.length; i++){ // loop through all cameras
        addGlowColorRenderTarget(allCameras[i]); // make each camera render glows
    }

    // check for Post Effects in active render target, warn user if there are
    if(script.warnPostEffects && global.deviceInfoSystem.isEditor()){ // only check for Post Effects if user hasn't disabled this, and if not on user's device
        var allPostEffects = getAllComponentsInScene("Component.PostEffectVisual", postEffectsFilter);
        if(allPostEffects.length > 0){ // if there are Post Effects that could cause issues, warn the user
            var postEffectsNames = "";
            for(var i = 0; i < allPostEffects.length; i++){
                postEffectsNames += "\n" + "-> " + allPostEffects[i].getSceneObject().name;
            }
            print(title + "---\nWARNING:\nThere are post effects in this scene that render to the the glowing Render Target. This is known to cause issues, as Post Effect Components overwrite Color Pass 1.\n\nIf you are experiencing problems with the glow, try the following:\n- Disable or recreate the Post Effect in a new Graph Empty material. Set the Shader's Target Count to 2, and make 'Color - Target 1' black with 0% opacity. Then, set the Post Effect's Render Order to a low number, like -100.\n- Or, a simpler solution is to have the Post Effect rendered on a separate Render Target.\n\nThe following SceneObjects could be causing issues when enabled:" + postEffectsNames + "\n---");
        }
    }
}



// delay cinematic glow to prevent visuals on first frame
function startAfterOneFrame(){
    var t = 0;
    var nextFrameEvent = script.createEvent("UpdateEvent");
    nextFrameEvent.bind(function(){
        if(t===1){
            script.removeEvent(nextFrameEvent);
            init();
        }
        t++;
    })
}
startAfterOneFrame();



function getAllCameras(){
    var foundCameras = getAllComponentsInScene("Component.Camera", camerasFilter);
    for(var i = 0; i < foundCameras.length; i++){
        // make list of all layers rendered by active cameras
        if(i===0){
            allRenderTargetLayers = foundCameras[i].renderLayer;
        }else{
            allRenderTargetLayers = allRenderTargetLayers.union(foundCameras[i].renderLayer);
        }
    }
    return {"foundCameras":foundCameras};
}



// makes color target for a Camera component, so this camera also renders to the glowMatteTarget
function addGlowColorRenderTarget(cam){
    var colorRenderTargets = cam.colorRenderTargets;
    var newCRT = Camera.createColorRenderTarget();
    newCRT.targetTexture = script.glowMatteTarget;
    newCRT.clearColor = vec4.zero();
    colorRenderTargets.push(newCRT);
    cam.colorRenderTargets = colorRenderTargets;
}



// helper function: find all components 'compName' in the scene, filter them using function compIsValidCheck
function getAllComponentsInScene(compName, compIsValidCheck){
    var found = [];

    // check sceneobject for relevant comps
    function scanSceneObject(obj){
        if(obj.isSame(script.getSceneObject())) return; // filter this sceneobject from search
        var comps = obj.getComponents(compName); // get all components on found sceneobject

		if(comps.length > 0){
			for(var i = 0; i < comps.length; i++){ // add all to list
                var comp = comps[i];
                if(!compIsValidCheck(comp)) return; // check if this component is relevant
				found.push(comps[i]); // store this component
			}
		}
    }

    // search sceneobject and its children recursively
    function iterateObj(obj){
        for(var i = 0; i < obj.getChildrenCount(); i++){
            var child = obj.getChild(i);
            scanSceneObject(child);
        	iterateObj(child);
        }
    }

	// go through whole scene, return accumulated results
    var rootObjectsCount = global.scene.getRootObjectsCount();
    for(var i = 0; i < rootObjectsCount; i++){
        var rootObj = global.scene.getRootObject(i);
        scanSceneObject(rootObj);
        iterateObj(rootObj);
    }
    return found;
}



// filter for found Camera components
function camerasFilter(comp){
    if(isNull(comp)) return; // comp doesn't exist
    if(isNull(comp.renderTarget)) return; // camera doesn't have a render texture
    if(!comp.renderTarget.isSame(script.mainCamera.renderTarget)) return; // render texture is different from specified
    return true;
}



// filter for found Post Effect components
function postEffectsFilter(comp){
    if(isNull(comp)) return; // comp doesn't exist
    if(!allRenderTargetLayers.contains(comp.getSceneObject().layer)) return; // Post Effect is not rendered by any of the cameras on the active Render Target
    return true;
}


# **Leonardo.ai Production API: A Structured Developer's Guide for Seamless Integration**

This report provides a definitive, developer-centric guide to the Leonardo.ai Production API. It is designed to replace fragmented documentation with a single, structured source of truth, enabling efficient and robust integration. We will deconstruct the API's full creative stack, from initial setup and authentication to advanced image and video generation, post-processing, and resource management. A central theme of this guide is navigating the API's asynchronous architecture, a critical concept for building responsive and reliable applications. By the end of this report, developers will have a granular understanding of every endpoint, parameter, and workflow, empowering them to leverage the full potential of the Leonardo.ai platform.

## **Section 1: Foundational Concepts & Configuration**

This section covers the non-negotiable prerequisites and core architectural principles a developer must understand before making a single generation request. Mastering these concepts is crucial for building a stable and scalable application.

### **1.1. API Access: Authentication & Subscription Plans**

Accessing the Leonardo.ai Production API requires a specific, programmatic-use subscription plan, which is entirely separate from the plans governing the web application interface. Plans such as "API Basic," "API Standard," and "API Pro" are designed for developers, while plans like "Free," "Apprentice," "Artisan," and "Maestro" grant access only to the web and mobile apps. This two-tiered subscription model is a critical distinction; a user with a high-tier web-app subscription does not automatically possess API access. This structure indicates that the API is positioned as a distinct, production-grade product for scalable applications, rather than a simple extension of the user interface.

For a developer, the first step is always to ensure an active API subscription is in place. This can be managed via the "API Access" section of the Leonardo.ai web application. Once subscribed, API keys can be generated from this same page. It is a best practice to use descriptive names for keys to easily identify them by application or environment (e.g., my-app-production, my-app-development).

All subsequent requests to the API must be authenticated. This is accomplished by including an Authorization header with a Bearer Token in every request. The format is Authorization: Bearer \<YOUR\_API\_KEY\>. Failure to provide a valid key tied to an active API subscription will result in an authorization error, often appearing as an "Invalid response from authorization hook," which is a common first hurdle for developers new to the platform.

### **1.2. The Asynchronous Workflow: Polling vs. Webhooks**

A fundamental architectural characteristic of the Leonardo.ai API is its asynchronous nature. Computationally intensive tasks such as image or video generation are not completed instantaneously. When a developer sends a POST request to a generation endpoint, the API acknowledges the request, initiates a background job, and immediately returns a response containing a unique job identifier, such as a generationId. The final media asset is not included in this initial response.

To retrieve the completed asset, developers have two primary methods: polling and webhooks.

Method 1: Polling  
The polling method involves the client application periodically sending GET requests to a status-checking endpoint, using the generationId from the initial response. For example, the GET /api/rest/v1/generations/{generationId} endpoint returns the status of a specific job. The client application must repeatedly call this endpoint until the status field in the response body reads COMPLETE. At that point, the response will contain the URL(s) of the generated media. While straightforward to implement for testing and supported by some third-party libraries , polling is inefficient for production systems. It generates a high volume of requests, can lead to rate-limiting issues, and introduces latency between job completion and retrieval.  
Method 2: Webhooks (Recommended)  
The architecturally superior and recommended best practice for production applications is the use of webhooks. When creating an API key, a developer can specify a webhook callback URL. Once the generation job is complete, Leonardo.ai's servers will automatically send a POST request to this designated URL. This payload contains the full generation result, including media URLs and metadata, eliminating the need for the client to poll for status updates.  
This event-driven approach is significantly more efficient and enables real-time notifications. To ensure security, webhook URLs must use the https protocol. Developers can also specify a separate webhook callback API key during setup. This key will be sent back by Leonardo's servers in the Authorization header of the callback request, allowing the developer's application to verify that the incoming request is legitimate. For network security and firewall configuration, Leonardo.ai provides a list of its egress IP addresses from which webhook requests will originate.

### **1.3. Cost and Credit Management**

All operations performed via the Production API consume credits from a dedicated API token balance, which is distinct from the token balance used in the web application. The cost of any given operation is not static; it varies based on the model selected, the output resolution, and the use of premium features like Alchemy or specific video models. For instance, a standard text-to-video generation might cost 200 credits, while a generation using the advanced Veo3 model costs 4000 credits.

This complexity makes proactive cost management a core development task. The API provides the necessary tools for a robust implementation. The GET /api/rest/v1/me endpoint allows an application to query the current user's account details, including the apiPaidTokens and apiSubscriptionTokens balances.

Critically, the API includes a dedicated pricing calculator endpoint: POST /api/rest/v1/pricing-calculator. This tool allows a developer to send the parameters of a potential job and receive an accurate credit cost estimate *before* committing to the generation. This is particularly valuable for complex jobs involving multiple features. The intended workflow for a production application should be:

1. Check the user's current credit balance using GET /me.  
2. Before executing a generation, send the proposed parameters to POST /pricing-calculator to determine the exact cost.  
3. If the user has sufficient credits, proceed with the generation request.  
4. Upon receiving the initial generation response, log the final apiCreditCost value returned by the API for reconciliation.

This four-step loop prevents failed jobs due to insufficient funds and enables transparent cost reporting to the end-user.

### **1.4. Asset Management: The Two-Step Image Upload Process**

To use a local image as an input for features like image-to-image or image-to-video, the file must first be uploaded to Leonardo.ai's cloud storage and registered as an "init image". This is not a single request but a two-step process that follows a standard secure cloud upload pattern.

1. **Request an Upload URL:** The developer first makes a POST request to https://cloud.leonardo.ai/api/rest/v1/init-image. The body of this request should specify the intended file extension (e.g., png, jpg). The API responds not with an image ID, but with a temporary, presigned URL and a collection of form fields required for the upload.  
2. **Upload the File:** The application must then immediately make a second POST request, this time to the presignedUrl received in step one. This request must use the multipart/form-data content type and include all the fields from the previous response, along with the raw binary data of the image file itself. This presigned URL is short-lived, typically expiring within two minutes, so the upload must be performed promptly.

Upon successful completion of the second step, the image is uploaded, and the API returns its permanent id. This id can then be used in subsequent generation requests. This process ensures that the application's long-term API key is not directly exposed to the file transfer process, enhancing security.

## **Section 2: Image Generation (POST /generations)**

This section details the API's primary workhorse endpoint, POST /api/rest/v1/generations. This single, powerful endpoint handles text-to-image, image-to-image, and a vast array of stylistic and quality enhancements. Its parameters are deconstructed thematically below.

### **2.1. Core Text-to-Image Generation**

The foundation of image creation is text-to-image generation, which transforms a descriptive string into a visual asset. The quality and style of the output are heavily influenced by the chosen model. Users reporting poor image quality are often using a default model and can achieve dramatically better results by specifying a more advanced one, such as Leonardo Phoenix or an SDXL-based model.

**Table 2.1: Core Generation Parameters**

| Parameter | Type | Required | Description | Example Value |
| :---- | :---- | :---- | :---- | :---- |
| prompt | string | Yes | The text description of the desired image. | A majestic cat in the snow |
| negative\_prompt | string | No | A text description of elements to exclude from the image. | blurry, deformed, ugly |
| modelId | string | No | The UUID of the generation model to use. See Appendix A for a detailed breakdown of model capabilities. If omitted, a default is used. | b24e16ff-06e3-43eb-8d33-4416c2d75876 |
| height | integer | No | The height of the image in pixels. Must be a multiple of 8, between 32 and 1536\. Defaults to 768\. | 1024 |
| width | integer | No | The width of the image in pixels. Must be a multiple of 8, between 32 and 1536\. Defaults to 768\. | 1024 |
| num\_images | integer | No | The number of images to generate in a single job. Must be between 1 and 8\. Defaults to 4\. | 2 |

### **2.2. High-Quality Pipelines: Alchemy & PhotoReal**

Beyond the core parameters, Leonardo.ai offers advanced processing pipelines that significantly enhance image quality. These are enabled via specific boolean flags, and their selection dictates which other fine-tuning parameters become available. This creates a decision tree for developers: the first choice is the pipeline, which then unlocks a specific set of controls.

* **Alchemy:** Enabled by setting alchemy: true, this parameter activates Leonardo's V2 pipeline, which generally produces higher-fidelity and more coherent results.  
* **PhotoReal:** Enabled by setting photoReal: true, this parameter engages a specialized pipeline fine-tuned for generating photorealistic images. Using PhotoReal requires alchemy to also be set to true. For PhotoReal V1, the modelId parameter should be omitted entirely.

**Table 2.2: Alchemy & PhotoReal Parameters**

| Parameter | Type | Description | Dependencies |
| :---- | :---- | :---- | :---- |
| alchemy | boolean | Enables the Alchemy V2 pipeline for enhanced quality. | Required for PhotoReal. |
| photoReal | boolean | Enables the specialized photorealism pipeline. | Requires alchemy: true. |
| photoRealVersion | string | Specifies the version of the PhotoReal pipeline to use. Options: v1, v2. | Requires photoReal: true. |
| photoRealStrength | number | Controls the depth of field effect in PhotoReal. Options: 0.55 (low), 0.5 (medium), 0.45 (high). | Requires photoReal: true. |
| contrastRatio | number | Adjusts the contrast ratio. Must be a float between 0 and 1\. | Requires alchemy: true. |
| expandedDomain | boolean | Enables the Expanded Domain feature of Alchemy for broader subject interpretation. | Requires alchemy: true. |
| highResolution | boolean | Enables the High Resolution feature of Prompt Magic for finer details. | Requires alchemy: true. |

### **2.3. Creative & Style Controls**

These parameters provide granular control over the aesthetic and composition of the generated image.

| Parameter | Type | Description | Range/Values |
| :---- | :---- | :---- | :---- |
| presetStyle | enum | Applies a predefined aesthetic style. Available options depend on whether Alchemy is enabled. See Appendix B for a full list. | e.g., CINEMATIC, ILLUSTRATION, DYNAMIC |
| guidance\_scale | integer | Controls how strictly the model adheres to the prompt. Higher values mean stronger adherence. Recommended value is 7\. | 1 to 20 |
| num\_inference\_steps | integer | The number of diffusion steps for the generation. More steps can increase detail but also generation time. | 10 to 60 |
| seed | integer | A specific number to initialize the generation. Using the same seed with the same prompt and parameters will produce similar results. | e.g., 123456789 |
| highContrast | boolean | Enables the High Contrast feature. Setting to false enables RAW mode. | true or false |
| contrast | number | Adjusts the contrast level. Required for Flux and Phoenix models. Accepts values \[1.0, 1.3, 1.8, 2.5, 3, 3.5, 4, 4.5\]. | 1.0 to 4.5 |

### **2.4. Image-to-Image Generation**

The same POST /generations endpoint is used for image-to-image tasks. This is achieved by providing the ID of a starting image, which guides the generation process. The API distinguishes between images uploaded by the user and images previously generated on the platform.

**Table 2.4: Image-to-Image Parameters**

| Parameter | Type | Description |
| :---- | :---- | :---- |
| init\_image\_id | string | The ID of an image uploaded via the two-step upload process. Use this for external images. |
| init\_generation\_image\_id | string | The ID of an image that was previously generated on the Leonardo.ai platform. |
| init\_strength | number | Controls the influence of the initial image on the final output. A value of 0.1 will be very different from the original, while 0.9 will be very similar. Must be a float between 0.1 and 0.9. |
| imagePromptWeight | number | A parameter to adjust the weight of the image prompt's influence. |

### **2.5. Image Guidance (ControlNets & Context Images)**

Image Guidance allows for more precise control over the structure and style of a generated image by using a reference image. The implementation varies depending on the model.

* **For most models (SDXL, Phoenix, etc.):** Use the controlnets array in your POST /generations request. Each object in the array defines a specific guidance type (e.g., Style Reference, Pose to Image) and its settings.  
* **For FLUX.1 Kontext:** This model uses a unique parameter, contextImages, for its advanced editing capabilities. Instead of controlnets, you provide an array of contextImages objects.

**Key Image Guidance Parameters:**

* initImageType: Specify UPLOADED for your own images or GENERATED for images created on the platform.  
* strengthType: Controls the guidance strength. Supported values vary by guidance type. For Style Reference, options are Low, Mid, High, Ultra, and Max. For Content and Character Reference, only Low, Mid, and High are supported.  
* weight: A numeric value from 0 to 2 that fine-tunes the strength.  
* influence: Used only when multiple Style References are applied to define the ratio of influence between them.

It is crucial to use the correct implementation (controlnets or contextImages) and the correct preprocessor IDs for the desired guidance and base model combination. For a detailed compatibility matrix, refer to Appendix A.

### **2.6. Applying Elements (LoRAs)**

In addition to preset styles, the API allows for the application of 'Elements,' which are fine-tuned stylistic models (often known as LoRAs) that can be layered onto a generation to achieve specific aesthetics. To use Elements, you must include an elements array in the body of your POST /generations request.

Each object within the elements array specifies a single Element to apply and its strength:

* akUUID (string, required): The unique identifier for the Element.  
* weight (number, required): A float value that controls the influence of the Element on the final image. The acceptable range for this value varies by Element.

It is crucial to ensure that the chosen Elements are compatible with the base model (modelId) you are using for the generation. For a comprehensive list of available Elements, their IDs, and model compatibility, please refer to Appendix D.

## **Section 3: Video Generation**

The API provides two distinct pathways for creating video content: generating a new video directly from a text prompt or animating an existing static image to create motion.

### **3.1. Text-to-Video Generation**

This feature allows for the direct creation of video clips from a textual description. The core functionality is accessed through a dedicated endpoint that supports multiple underlying generation models, each with different capabilities and credit costs.

* **Endpoint:** POST https://cloud.leonardo.ai/api/rest/v1/generations-text-to-video  
* **Models:** The model parameter allows selection between different engines. MOTION2 is a standard model, while VEO3 is a premium model that supports audio generation and produces higher-fidelity cinematic sequences at a significantly higher credit cost.

**Table 3.1: Text-to-Video Parameters**

| Parameter | Type | Required | Description | Example Value |
| :---- | :---- | :---- | :---- | :---- |
| prompt | string | Yes | The text description of the desired video content. | A dog walking on the beach |
| negativePrompt | string | No | A description of elements or concepts to exclude from the video. | blurry, shaky camera |
| model | enum | No | The generation model to use. Defaults to MOTION2. | MOTION2, VEO3 |
| resolution | enum | No | The resolution of the output video. Defaults to RESOLUTION\_480. VEO3 only supports RESOLUTION\_720. | RESOLUTION\_480, RESOLUTION\_720 |
| height | integer | No | The height of the video in pixels. Defaults to 480\. | 480 |
| width | integer | No | The width of the video in pixels. Defaults to 832\. | 832 |
| frameInterpolation | boolean | No | If true, smoothly blends frames for more fluid motion. | true |
| promptEnhance | boolean | No | If true, the prompt will be automatically enhanced by the AI before generation. | false |
| styleIds | array of strings | No | An array of UUIDs corresponding to predefined styles for motion, vibe, lighting, etc. | \["fbed015e-594e-4f78-b4be-3b07142aaa1e"\] |

A significant usability challenge of this endpoint is the styleIds parameter. The API requires specific UUIDs to control elements like camera motion (e.g., "Crane Down") or lighting (e.g., "Golden Hour"). These UUIDs are not intuitive and must be looked up. The reference table in Appendix C is essential for effectively using this feature.

### **3.2. Image-to-Video (Motion) Generation**

This functionality, often referred to as "Motion," animates a static source image to create a short video clip. It uses the Stable Video Diffusion (SVD) model under the hood.

* **Endpoint:** POST https://cloud.leonardo.ai/api/rest/v1/generations-motion-svd

The source image can be an image uploaded by the user, an image previously generated on the platform, or a variation of another image (e.g., an upscale). The boolean flags isInitImage and isVariation are used to specify the type of imageId being provided. The primary creative control is motionStrength, an integer that dictates the intensity of the resulting animation.

**Table 3.2: Image-to-Video Parameters**

| Parameter | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| imageId | string | Yes | The ID of the source image to animate. |
| motionStrength | integer | No | The intensity of the motion effect, on a scale from 1 (subtle) to 10 (dramatic). |
| isPublic | boolean | No | Sets the visibility of the generated video. Defaults to true. |
| isInitImage | boolean | No | Must be set to true if the imageId corresponds to an image uploaded by the user. |
| isVariation | boolean | No | Must be set to true if the imageId corresponds to a variation of another image (e.g., an upscale). |

## **Section 4: Prompt Enhancement**

The API provides powerful tools for refining and expanding user prompts. This can be performed as a standalone, preliminary step or integrated directly into the main image generation workflow. The choice between these two methods presents a strategic trade-off for the developer.

### **4.1. Standalone Prompt Improvement**

By using the dedicated prompt improvement endpoint, an application can receive an enhanced prompt for a low credit cost (4 credits) before committing to the more expensive image generation process. This allows for a workflow where the improved prompt can be presented to the user for approval or further editing.

* **Endpoint:** POST https://cloud.leonardo.ai/api/rest/v1/prompt/improve

This endpoint operates in two distinct modes depending on the supplied parameters:

1. **Improve Prompt:** This mode is triggered by providing only the prompt parameter (with a maximum length of 200 characters). The AI expands this short input into a rich, detailed, and descriptive prompt.  
2. **Edit with AI:** This mode is triggered by providing both a prompt and promptInstructions. The AI will modify the original prompt based on the specific directions given in promptInstructions (e.g., "Change the context to a space theme").

**Table 4.1: Standalone Prompt Enhancement Parameters**

| Mode | Parameter | Type | Description |
| :---- | :---- | :---- | :---- |
| Improve Prompt | prompt | string | The short prompt to be expanded by the AI. |
| Edit with AI | prompt | string | The original prompt to be modified. |
| Edit with AI | promptInstructions | string | Specific instructions on how to change the prompt. |

### **4.2. Integrated Prompt Enhancement**

For a more streamlined, "fire-and-forget" workflow, the same enhancement capabilities can be invoked directly within the main image generation call. This is achieved by using specific parameters in the POST /generations request body. This method combines the enhancement and generation into a single atomic transaction, which is faster but removes the opportunity for user review of the enhanced prompt before credits are spent on generation.

* To **Improve a Prompt**, set enhancePrompt: true.  
* To **Edit with AI**, set enhancePrompt: true and also provide the enhancePromptInstructions parameter with your specific directions.

## **Section 5: Post-Generation Image Adjustments (Variations)**

The Leonardo.ai API offers a suite of endpoints for modifying or enhancing previously generated images. These operations are referred to as "variations," and each one initiates a new asynchronous job.

### **5.1. Image Upscaling**

The API provides a tiered approach to upscaling, offering at least three distinct methods that cater to different needs, from simple resolution boosts to highly creative reinterpretations.

#### **5.1.1. Simple Upscale (Legacy)**

This is the most basic upscaling option, providing a straightforward resolution increase with minimal configuration. It is ideal for quick, non-creative enhancements.

* **Endpoint:** POST /api/rest/v1/variations/upscale  
* **Parameters:**  
  * id (string, required): The ID of the image to upscale.

#### **5.1.2. Universal Upscaler**

This is the platform's primary, production-grade upscaling tool. It is highly configurable, offering different modes and creative controls for achieving high-quality results suitable for professional use.

* **Endpoint:** POST /api/rest/v1/variations/universal-upscaler

**Table 5.1: Universal Upscaler Parameters**

| Parameter | Type | Description | Modes |
| :---- | :---- | :---- | :---- |
| generatedImageId | string | The ID of a previously generated image to upscale. | All |
| initImageId | string | The ID of a user-uploaded init image to upscale. | All |
| variationId | string | The ID of a variation image to upscale. | All |
| upscalerStyle | enum | The style for Legacy mode. Options: GENERAL, CINEMATIC, 2D ART & ILLUSTRATION, CG ART & GAME ASSETS. | Legacy |
| ultraUpscaleStyle | enum | The style for Ultra mode. Options: ARTISTIC, REALISTIC. | Ultra |
| upscaleMultiplier | number | The factor by which to increase the image resolution. Must be between 1.0 and 2.0. | All |
| creativityStrength | integer | How much creative detail the AI should add. Must be between 1 and 10\. | All |
| detailContrast | integer | Affects the contrast of fine details. Must be between 1 and 10\. | Ultra only |
| similarity | integer | How closely the output should resemble the original structure. Must be between 1 and 10\. | Ultra only |
| prompt | string | An optional prompt to guide the upscaler's creative additions. | All |

#### **5.1.3. LCM Realtime Upscale**

This is a specialized upscaler designed for Latent Consistency Models (LCM), likely optimized for real-time or near-real-time applications. Uniquely, it accepts the source image directly in the request body as a base64-encoded string, bypassing the standard init image upload process.

* **Endpoint:** POST /api/rest/v1/lcm-upscale  
* **Parameters:**  
  * imageDataUrl (string, required): The base64-encoded image data.  
  * prompt (string, required): A prompt to guide the upscale.  
  * strength (number): Creativity strength, from 0.1 to 1.0.  
  * style (enum): A selection of aesthetic styles (e.g., CINEMATIC, PHOTOGRAPHY).

### **5.2. Image Unzoom**

This variation performs an "outpainting" operation, expanding the canvas around the original image and using AI to fill in the new areas in a contextually consistent manner.

* **Endpoint:** POST /api/rest/v1/variations/unzoom  
* **Parameters:**  
  * id (string, required): The ID of the image to unzoom.  
  * isVariation (boolean, optional): Set to true if the provided id is the result of a previous variation job.

### **5.3. Background Removal**

This tool automatically identifies the subject of an image and removes the background, resulting in a transparent PNG.

* **Endpoint:** POST /api/rest/v1/variations/nobg  
* **Parameters:**  
  * id (string, required): The ID of the image from which to remove the background.  
  * isVariation (boolean, optional): Set to true if the provided id is the result of a previous variation job.

A critical and easily missed parameter in both the Unzoom and Background Removal endpoints is isVariation. The API's error documentation clarifies its purpose: if an application is chaining variation operations (e.g., first upscaling an image, then removing the background from the upscaled result), the id passed to the second operation is a "variation ID." In this case, the isVariation flag must be set to true. This signals to the API that it is processing the output of a prior variation job, not an original generation. Overlooking this flag is a likely source of errors in complex image processing workflows.

## **Section 6: Video Post-Processing**

The API also includes endpoints for enhancing generated video clips, currently focused on upscaling.

### **6.1. Video Upscaling**

This endpoint takes a previously generated video and increases its resolution. This is an essential step for preparing video content for high-definition displays.

* **Endpoint:** POST /api/rest/v1/generations-video-upscale

The functionality is currently limited to a single target resolution.

**Table 6.1: Video Upscale Parameters**

| Parameter | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| sourceGenerationId | string | Yes | The generationId of the source video to be upscaled. |
| resolution | enum | Yes | The target resolution for the upscale. Currently, only RESOLUTION\_720 is supported. |

## **Section 7: Utility and Resource Management**

This section covers essential endpoints for retrieving historical data and managing user-created assets. These are vital for building application features like user galleries, account management, and data privacy compliance.

### **7.1. Retrieving Generation History**

The API provides endpoints to access both individual job details and a user's complete generation history.

* **Get Single Generation:** GET /api/rest/v1/generations/{id}  
  * This endpoint is primarily used for polling the status of a specific asynchronous job. It returns detailed information about a single generation, including its status (PENDING, COMPLETE, FAILED) and, upon completion, the URLs of the output media.  
* **Get All Generations for User:** GET /api/rest/v1/generations/user/{userId}  
  * This endpoint retrieves a list of all generations created by a specific user, making it ideal for populating a user's history feed or gallery within an application. The endpoint supports pagination through offset and limit query parameters to efficiently handle large histories.

### **7.2. Deleting Resources**

To allow for proper data management and user privacy, the API provides endpoints to permanently delete user-created assets.

* **Delete Custom Model:** DELETE /api/rest/v1/models/{id}  
  * Deletes a custom model that a user has trained.  
* **Delete Init Image:** DELETE /api/rest/v1/init-image/{id}  
  * Deletes an image that was uploaded by the user via the two-step upload process.  
* **Delete Texture Generation:** DELETE /api/rest/v1/generations-texture/{id}  
  * Deletes a texture generation associated with a 3D model.

## **Section 8: Functional API Breakdown**

This section provides a functional breakdown of the Leonardo.ai API, grouping endpoints and features by their core purpose. It is designed to give developers a quick reference for what each part of the API does, what models and settings are available, and what outputs to expect.

### **8.1 Image Generation**

This category covers the creation of new images from text or other images.

* **Endpoint:** POST /api/rest/v1/generations  
* **Models:** All image models (e.g., Flux, Phoenix, SDXL, Kino, Vision).  
* **Core Settings:**  
  * prompt (string, required): The text description of the image.  
  * modelId (string): The UUID of the model to use.  
  * negative\_prompt (string): Elements to exclude.  
  * height / width (integer): Image dimensions, must be a multiple of 8\.  
  * num\_images (integer): Number of images to generate (1-8).  
  * guidance\_scale (integer): How strongly to adhere to the prompt (1-20).  
  * num\_inference\_steps (integer): Number of diffusion steps (10-60).  
  * seed (integer): For reproducible results.  
* **Model-Specific Settings:**  
  * **Flux & Phoenix Models:** contrast (number) is a required parameter.  
* **Image-to-Image Settings:**  
  * init\_image\_id (string): ID of a user-uploaded image.  
  * init\_strength (number): Influence of the init image (0.1-0.9).  
* **Expected Output:**  
  * **Initial Response:** An object containing sdGenerationJob with a unique generationId.  
  * **Final Output (via Polling/Webhook):** A generations\_by\_pk object containing an array of generated\_images. Each image object includes its id, url, and nsfw status.  
* **Supported Features:**  
  * **Alchemy & PhotoReal:** High-quality pipelines enabled with alchemy: true and photoReal: true.  
  * **Preset Styles:** Apply broad aesthetic styles using the presetStyle parameter (see Appendix B).  
  * **Image Guidance (ControlNets):** Use the controlnets array to apply Style Reference or Character Reference. Compatibility varies by model (see Appendix A).  
  * **Elements (LoRAs):** Apply fine-tuned stylistic models using the elements array (see Appendix D).

### **8.2 Video Generation**

This category covers creating video clips from text or animating static images.

* **Function: Text-to-Video**  
  * **Endpoint:** POST /api/rest/v1/generations-text-to-video  
  * **Models:** MOTION2 (standard), VEO3 (premium, includes audio).  
  * **Settings:** prompt (required), model, resolution (RESOLUTION\_480 or RESOLUTION\_720), height, width, frameInterpolation.  
  * **Expected Output:** Initial response with generationId in a motionVideoGenerationJob object. Final output includes the motionMP4URL.  
  * **Supported Features:** Motion Controls (e.g., Dolly In) and Styles (e.g., Golden Hour) applied via an array of styleIds (see Appendix C).  
* **Function: Image-to-Video (Motion SVD)**  
  * **Endpoint:** POST /api/rest/v1/generations-motion-svd  
  * **Settings:** imageId (required), motionStrength (integer 1-10), isInitImage (boolean, for user-uploaded images), isVariation (boolean, for upscales, etc.).  
  * **Expected Output:** Initial response with generationId in a motionSvdGenerationJob object. Final output includes the motionMP4URL.  
  * **Supported Features:** Motion intensity is controlled via the motionStrength parameter.

### **8.3 Image & Video Upscaling**

This category includes all functions designed to increase the resolution of images and videos.

* **Function: Universal Upscaler**  
  * **Endpoint:** POST /api/rest/v1/variations/universal-upscaler  
  * **Settings:** Input via generatedImageId, initImageId, or variationId. Control with upscalerStyle (Legacy mode), ultraUpscaleStyle (Ultra mode), creativityStrength, and upscaleMultiplier (1.0-2.0).  
  * **Expected Output:** An initial response with a universalUpscaler object containing the variation id.  
  * **Supported Features:** Offers distinct "Legacy" and "Ultra" modes for different quality and creative needs.  
* **Function: LCM Realtime Upscale**  
  * **Endpoint:** POST /api/rest/v1/lcm-upscale  
  * **Settings:** Requires imageDataUrl (base64 encoded image) and prompt. Other settings include strength and style.  
  * **Expected Output:** An initial response with a lcmGenerationJob object containing the variationId.  
* **Function: Simple Upscale (Legacy)**  
  * **Endpoint:** POST /api/rest/v1/variations/upscale  
  * **Settings:** Requires only the id of the image to upscale.  
  * **Expected Output:** An initial response with an sdUpscaleJob object containing the variation id.  
* **Function: Video Upscale**  
  * **Endpoint:** POST /api/rest/v1/generations-video-upscale  
  * **Settings:** Requires sourceGenerationId and resolution (currently only RESOLUTION\_720 is supported).  
  * **Expected Output:** An initial response with a motionVideoGenerationJob object containing the variationId.

### **8.4 Prompt Enhancement**

This category covers tools for improving or modifying text prompts.

* **Function: Standalone Prompt Improvement**  
  * **Endpoint:** POST /api/rest/v1/prompt/improve  
  * **Settings:** Use prompt to improve, or prompt and promptInstructions to edit.  
  * **Expected Output:** A direct (synchronous) response containing a promptGeneration object with the new prompt and apiCreditCost.  
* **Function: Integrated Prompt Enhancement**  
  * **Endpoint:** POST /api/rest/v1/generations  
  * **Settings:** Set enhancePrompt: true (to improve) or enhancePrompt: true with enhancePromptInstructions (to edit).  
  * **Expected Output:** The standard asynchronous image generation output (generationId, etc.). The enhancement happens internally.

### **8.5 Other Image Adjustments**

This category includes other post-processing functions.

* **Function: Unzoom (Outpainting)**  
  * **Endpoint:** POST /api/rest/v1/variations/unzoom  
  * **Settings:** Requires the id of the image and the optional boolean isVariation.  
  * **Expected Output:** An initial response with an sdUnzoomJob object containing the variation id.  
* **Function: Background Removal**  
  * **Endpoint:** POST /api/rest/v1/variations/nobg  
  * **Settings:** Requires the id of the image and the optional boolean isVariation.  
  * **Expected Output:** An initial response with an sdNobgJob object containing the variation id.

## **Appendix: Master Reference Tables**

This appendix contains consolidated, easy-to-reference tables for values used across multiple API calls, saving developers from hunting through different documentation pages.

### **Table A: Platform Model Capabilities Reference**

This table provides the names, UUIDs, and key operational parameters for popular platform models.

| Model Name | Model ID | Key Settings | Constraints | Supported Image Guidance |
| :---- | :---- | :---- | :---- | :---- |
| **FLUX.1 Kontext** | 28aeddf8-bd19-4803-80fc-79602d1a9989 | Omni model for precise, instruction-based image editing. | Optimized for precise, controllable image editing. | Uses the **contextImages** parameter for image-to-image and editing tasks (not standard ControlNets). |
| **Flux Dev (Precision)** | b2614463-296c-462a-9586-aafdb8f00e36 | contrast parameter is required. | width/height must be a multiple of 8, between 32-1536. | **Style Reference:** ID 299 **Content Reference:** ID 233 |
| **Flux Schnell (Speed)** | 1dd50843-d653-4516-a8e3-f0238ee453ff | contrast parameter is required. | width/height must be a multiple of 8, between 32-1536. | **Style Reference:** ID 298 **Content Reference:** ID 232 |
| **Leonardo Phoenix 1.0** | de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3 | contrast parameter is required. Excels at prompt adherence and text rendering. | contrast must be \>= 2.5 if alchemy: true. width/height must be a multiple of 8, between 32-1536. Cannot be used with Canvas Inpainting. | **Style Reference:** ID 166 **Character Reference:** ID 397 **Content Reference:** ID 364 |
| **Leonardo Phoenix 0.9** | 6b645e3a-d64f-4341-a6d8-7a3690fbf042 | contrast parameter is required. Preview version. | contrast must be \>= 2.5 if alchemy: true. width/height must be a multiple of 8, between 32-1536. Cannot be used with Canvas Inpainting. | **Style Reference:** ID 166 **Character Reference:** ID 397 **Content Reference:** ID 364 |
| **Leonardo Lightning XL** | b24e16ff-06e3-43eb-8d33-4416c2d75876 | High-speed generalist model. | width/height must be a multiple of 8, between 32-1536. Cannot be used with Canvas Inpainting. | **Style Reference:** ID 67 **Character Reference:** ID 133 **Content Reference:** ID 100 |
| **Leonardo Anime XL** | e71a1c2f-4f80-4800-934f-2c68979d8cc8 | High-speed model for anime and illustrative styles. | width/height must be a multiple of 8, between 32-1536. Cannot be used with Canvas Inpainting. | **Style Reference:** ID 67 **Character Reference:** ID 133 **Content Reference:** ID 100 |
| **Leonardo Diffusion XL** | 1e60896f-3c26-4296-8ecc-53e2afecc132 | Core Leonardo model. Good results from short prompts. | width/height must be a multiple of 8, between 32-1536. | **Style Reference:** ID 67 **Character Reference:** ID 133 **Content Reference:** ID 100 |
| **Leonardo Kino XL** | aa77f04e-3eec-4034-9c07-d0f619684628 | Strong focus on cinematic outputs. Excels at wide aspect ratios. | width/height must be a multiple of 8, between 32-1536. | **Style Reference:** ID 67 **Character Reference:** ID 133 **Content Reference:** ID 100 |
| **Leonardo Vision XL** | 5c232a9e-9061-4777-980a-ddc8e65647c6 | Versatile model excelling at realism and photography. | width/height must be a multiple of 8, between 32-1536. | **Style Reference:** ID 67 **Character Reference:** ID 133 **Content Reference:** ID 100 |
| **SDXL 1.0** | 16e7060a-803e-4df3-97ee-edcfa5dc9cc8 | General purpose diffusion model. | width/height must be a multiple of 8, between 32-1536. | **Style Reference:** ID 67 **Character Reference:** ID 133 **Content Reference:** ID 100 |
| **AlbedoBase XL** | 2067ae52-33fd-4a82-bb92-c2c55e7d2786 | Generalist model tending towards CG artistic outputs. | width/height must be a multiple of 8, between 32-1536. | **Style Reference:** ID 67 **Character Reference:** ID 133 **Content Reference:** ID 100 |
| **Lucid Realism** | 05ce0082-2d80-4a2d-8653-4d1c85e2418e | Fine-tuned for hyper-photorealistic clarity (lighting, skin texture). | width/height must be a multiple of 8, between 32-1536. | **Style Reference:** ID 431 **Content Reference:** ID 430 |
| **Lucid Origin** | 7b592283-e8a7-4c5a-9ba6-d18c31f258b9 | contrast parameter is required. Versatile, high-adherence model trained for Full HD. | width/height must be a multiple of 8, between 32-1536. | **Style Reference:** ID 431 **Content Reference:** ID 430 |

### **Table B: Image Generation presetStyle Reference**

The presetStyle parameter in the image generation endpoint changes its available options based on whether alchemy is enabled.

| Style Name | Alchemy Required? |
| :---- | :---- |
| LEONARDO | No |
| NONE | No / Yes |
| ANIME | Yes |
| BOKEH | Yes |
| CINEMATIC | Yes |
| CREATIVE | Yes |
| DYNAMIC | Yes |
| ENVIRONMENT | Yes |
| FASHION | Yes |
| FILM | Yes |
| FOOD | Yes |
| GENERAL | Yes |
| HDR | Yes |
| ILLUSTRATION | Yes |
| LONG\_EXPOSURE | Yes |
| MACRO | Yes |
| MINIMALISTIC | Yes |
| MONOCHROME | Yes |
| MOODY | Yes |
| NEUTRAL | Yes |
| PHOTOGRAPHY | Yes |
| PORTRAIT | Yes |
| RAYTRACED | Yes |
| RENDER\_3D | Yes |
| RETRO | Yes |
| SKETCH\_BW | Yes |
| SKETCH\_COLOR | Yes |
| STOCK\_PHOTO | Yes |
| VIBRANT | Yes |

### **Table C: Text-to-Video styleId UUID Reference**

This table provides the essential mapping between human-readable style names and the UUIDs required by the styleIds parameter in the text-to-video endpoint.

| Style Type | Style Name | styleId (UUID) |
| :---- | :---- | :---- |
| **Motion Control** | Bullet Time | fbed015e-594e-4f78-b4be-3b07142aaa1e |
|  | Crane Down | 5a1d2a6a-7709-4097-9158-1b7ae6c9e647 |
|  | Crane Up | c765bd57-cdc5-4317-a600-69a8bd6c4ce6 |
|  | Dolly In | ece8c6a9-3deb-430e-8c93-4d5061b6adbf |
|  | Dolly Left | f507880a-3fa8-4c3a-96bb-3ce3b70ac53b |
|  | Dolly Out | 772cb36a-7d18-4250-b4aa-0c3f1a8431a0 |
|  | Dolly Right | 587a0109-30be-4781-a18e-e353b580fd10 |
|  | Handheld | 75722d13-108f-4cea-9471-cb7e5fc049fe |
|  | Orbit Left | 74bea0cc-9942-4d45-9977-28c25078bfd4 |
|  | Orbit Right | aec24e36-a2e8-4fae-920c-127d276bbe4b |
|  | Tilt Down | a1923b1b-854a-46a1-9e26-07c435098b87 |
|  | Tilt Up | 6ad6de1f-bd15-4d0b-ae0e-81d1a4c6c085 |
| **Vibe** | Clay | 964d8a8f-865b-48c5-b79e-e75ae8727648 |
|  | Color Sketch | 9cdfea2a-b4ab-4e97-a558-ec9fcb78f30a |
|  | Logo | 12b0d8c9-5cf8-4094-a3e5-6809bc269e21 |
| **Lighting** | Backlight | c39fe4f8-76d6-4aad-899b-e7ca5a4148f3 |
|  | Golden Hour | 3f705252-1197-4f59-b6ed-21625dce6a65 |
|  | Low Key | 1974bd47-75bb-499a-9c7a-354913904fcf |
|  | Rainy | fa347beb-6d70-482d-94a8-a70736e9e7f1 |
|  | Soft Light | 746e70e5-ab4d-4f39-9057-75698cb64bc2 |
|  | Volumetric | 92c2d8d4-9757-4cbf-88f3-d7ea54c425af |
| **Shot Type** | Bokeh | 2e2669d5-4473-4ab9-b476-9f0a314bf661 |
|  | Cinematic | a0f4907f-8cd0-41de-b67c-460ec3a2bda0 |
|  | Close Up | ba6baeab-1a8f-4cb8-b0f5-efc13a805371 |
|  | Overhead | 8eb75811-5148-40ac-8abc-531e64f6e269 |
|  | Spooky | 49dfd828-5473-4594-9187-c6129aeaa4bf |

### **Table D: Elements (LoRAs) Reference**

This table provides a list of available Elements, their IDs, and compatibility information.

| Element Name | akUUID (ID) | Compatible Base Model | Default Weight | Weight Range |
| :---- | :---- | :---- | :---- | :---- |
| **Styles & Aesthetics** |  |  |  |  |
| Celtic Punk | 01b6184e-3905-4dc7-9ec6-4f09982536d5 | v1\_5 | 1 | \-1 to 2 |
| Sparklecore | 90fa02f2-fb7a-4c6a-bac2-4074dfab1a4a | SDXL\_1\_0 | 1 | \-2 to 2 |
| Crystalline | af983e1a-48f6-4b59-b45c-9d731be72901 | v1\_5 | 1 | \-1 to 2 |
| Ebony & Gold | 933191a8-76a5-444b-bafd-32c7b1f36f99 | v1\_5 | 1 | \-1 to 2 |
| Solarpunk | f663d120-0692-4e0a-9917-36f92b034aef | SDXL\_1\_0 | 0.7 | \-2 to 2 |
| Gingerbread | 20219ada-a74e-4d4c-acd0-d02933e56ca3 | v1\_5 | 1 | \-1 to 2 |
| Glass & Steel | ffbcdf0f-17ce-4cd7-905e-2a04e01f54fb | v1\_5 | 1 | \-1 to 2 |
| Inferno | 9a3af8d7-c66c-4d32-b337-90af2bcf7d7f | v1\_5 | 1 | \-1 to 2 |
| Ivory & Gold | 09d18d54-7846-4add-9b7f-97ac571d5a75 | v1\_5 | 1 | \-1 to 2 |
| Kids Illustration | e6f33e53-5e66-43eb-bc4d-6b89ed4e3280 | SDXL\_1\_0 | 1 | \-1 to 2 |
| Lunar Punk | 9a551dc4-1b79-43d1-9d48-2d0e454c5884 | v1\_5 | 1 | \-1 to 2 |
| Pirate Punk | 9317f294-f59e-4b20-801d-6a6352c6c0c7 | v1\_5 | 1 | \-1 to 2 |
| Tiki | 2f750d95-60d8-43e2-a84c-4cdfd22420ca | v1\_5 | 1 | \-1 to 2 |
| Toxic Punk | 77a46ac2-ee81-4cb3-b050-4dd035ad6aa3 | v1\_5 | 1 | \-1 to 2 |
| White Ethereal | 68857120-f6fa-4333-b860-285e4cce218a | SDXL\_1\_0 | 0.7 | \-2 to 2 |
| Toon & Anime | d5d5ce55-5f3b-4bea-bb37-df6a4b5f3519 | SDXL\_1\_0 | 1 | \-1 to 2 |
| Colorful Scribbles | 5abf98fe-cad7-4335-9c62-88986c32138c | SDXL\_1\_0 | 0.7 | \-2 to 2 |
| Folk Art Illustration | 62667fde-70da-4db5-b047-8c70b43c38e7 | SDXL\_1\_0 | 1 | \-1 to 2 |
| Psychedelic Art | ffd28fd2-2a4b-4220-9778-882f6943b516 | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Oldschool Comic | 12eb63cd-da9e-440a-958d-f09595829256 | SDXL\_1\_0 | 0.7 | \-2 to 2 |
| Fiery Flames | dbcb8b6a-f340-4cf8-b380-af0616e9c343 | SDXL\_1\_0 | 0.7 | \-2 to 2 |
| Modern Analog Photography | 8dac37a4-b3ee-404b-8198-17ed356b7afe | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Dragon Scales | 840f7698-2db2-4356-aa92-9444cea38223 | SDXL\_1\_0 | 1 | \-2 to 2 |
| Cybertech | 3cc57e9b-dd82-44d7-8ecf-9e4a27d9d120 | SDXL\_1\_0 | 0.7 | \-2 to 3 |
| Glitch Art | 7e44ef18-f78e-46f3-8ac4-0cdc759372d5 | SDXL\_1\_0 | 1 | \-2 to 2 |
| Soft Pastel Anime | 383a7d66-13a0-4225-96ec-d15f83ef9c37 | SDXL\_1\_0 | 0.7 | \-2 to 2 |
| Pop Surrealism | e3063098-09fb-46b7-90ba-c7b2eef6d824 | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Rainbowcore | e4cbd583-f2ea-4be1-b9d5-b528344ac3d9 | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| CGI Noir | 238c8691-713c-47c6-b43c-11a790d09dd8 | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Simple Flat Illustration | 5f3e58d8-7af3-4d5b-92e3-a3d04b9a3414 | SDXL\_1\_0 | 1 | \-2 to 2 |
| Coloring Book | d0ebdbf7-a570-4b93-8406-306bbb2a3469 | SDXL\_1\_0 | 1 | \-1 to 2 |
| Soft Retro Futurism | 476a780a-66fc-495e-ac81-c6df1bf3f274 | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Medieval Illustration | 4f8e206e-45a8-42b3-b68a-f537371157a7 | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Dreamy Acrylics | 1980191d-9336-4eca-ae1b-c798f28a2b1a | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Cosmic Retro | 599f6886-02dc-46be-b7ab-61ed6da4946c | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Folk Art Illustration (Flux) | 92d23ed7-3f9c-4cfc-bfef-3237f17a6f7d | FLUX\_DEV | 0.8 | \-2 to 2 |
| Dopamine Illustration | 8077544e-e507-425e-ad0a-6250c42fd058 | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Editorial Illustration | 0ad0fb54-4a78-4c7c-b143-7e818d242be1 | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Surreal Collage | ca53dd41-c9ec-46b7-b906-2bcb61ad3273 | v2 | 1 | \-1 to 2 |
| Baroque | 66a7e05b-fad2-4c4a-a209-d69b2549d332 | v1\_5 | 1 | \-1 to 2 |
| Biopunk | 2b95b214-3d9f-46db-ac3d-a019047ab520 | v1\_5 | 1 | \-1 to 2 |
| Vintage Christmas Illustration | 97746a20-7a01-4047-8a52-f3e9ec0744dd | SDXL\_1\_0 | 1 | \-2 to 2 |
| Fantasy Icons | 75d38510-3b93-4af9-b627-93a95f789328 | SDXL\_1\_0 | 1 | \-2 to 2 |
| Digital Painting | 4248234d-345f-473a-b185-e172d7dbaa8b | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Celshaded Anime | 5aa85bbc-30bd-4c25-85e2-91a1ce56ae83 | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Abstract Line Art (Flux) | 93cec898-0fb0-4fb0-9f18-8b8423560a1d | FLUX\_DEV | 1 | \-2 to 2 |
| 90s Retro Anime | 7f404d0b-432d-470f-be04-2867f83eb5b4 | WAN21 | 1 | \-2 to 2 |
| Colorpop | 815de207-d352-4d46-9310-3fcd5324a7e2 | SDXL\_1\_0 | 1 | \-2 to 2 |
| Glowwave | 90eb308a-8922-4c9a-98fc-869ef0714489 | SDXL\_1\_0 | 0.7 | \-2 to 2 |
| Game UI | 1f01e542-b8a9-44e7-bb9d-71fd86b59c8b | SDXL\_1\_0 | 1 | \-2 to 2 |
| Medieval Illustration (Flux) | e3675262-c247-4f93-a9a8-eee7aaf45152 | FLUX\_DEV | 1 | \-2 to 2 |
| Toon & Anime (Flux) | 7c040ea3-cbed-455d-825a-2657eea36aae | FLUX\_DEV | 1 | \-2 to 2 |
| Cute Handdrawn | bf8eff23-d537-4323-b3aa-396dfeee8776 | FLUX\_DEV | 1 | \-2 to 2 |
| Retro Pastel | b1db3171-7f71-457d-aeb4-f810f6eb019d | FLUX\_DEV | 1 | \-2 to 2 |
| Eyes In | 148b50d0-2040-4524-a36f-6e330f9e362e | WAN21 | 1 | \-2 to 2 |
| Abstract Line Art | bf089a40-60cd-4ca0-8101-a10de44850b7 | SDXL\_1\_0 | 1 | \-2 to 2 |
| 3D Sculpt | e97f51ea-60dc-4763-a692-09200c843ac6 | SDXL\_1\_0 | 1 | \-2 to 2 |
| Oldschool Comic (Flux) | 28eb53a4-8da6-47c1-b73e-6541f4d65407 | FLUX\_DEV | 1 | \-2 to 2 |
| Crash Zoom In | b0191ad1-a723-439c-a4bc-a3f5d5884db3 | WAN21 | 1 | \-2 to 2 |
| App Icon | 458a9a60-a6d9-46c7-b346-bd0a9103c219 | FLUX\_DEV | 1 | 2 to 2 |
| Vibrant Iridescence Painting | cff579f8-f93e-4d12-bf69-5fb186669ca0 | FLUX\_DEV | 1 | \-2 to 2 |
| Robo Arm | 8df55fe2-5c6f-4dbf-8ade-eb997807ca0d | WAN21 | 0.9 | \-2 to 2 |
| Claynimation | 649ddca4-fcef-4bb7-95fa-ef3c35110b14 | WAN21 | 1 | \-2 to 2 |
| Glasscore | a699f5da-f7f5-4afe-8473-c426b245c145 | SDXL\_1\_0 | 1 | \-2 to 2 |
| Woodcut Illustration | 4fc2cb01-55f0-4f23-a317-f540c08eb548 | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Crane Up | c765bd57-cdc5-4317-a600-69a8bd6c4ce6 | WAN21 | 1 | \-2 to 2 |
| Medium Zoom In | f46d8e7f-e0ca-4f6a-90ab-141d731f47ae | WAN21 | 1 | \-2 to 2 |
| Wooden Craft | 613cf2d5-bc0b-4336-8efa-d25dc112c41f | FLUX\_DEV | 1 | \-2 to 2 |
| Dream Geometry | e6ef8eac-ba9f-4ca4-ab37-32ed1f09ede9 | FLUX\_DEV | 1 | \-2 to 2 |
| Felted | c1888bb5-2179-44fe-ba0b-47669c7c6f8f | WAN21 | 1 | \-2 to 2 |
| Super Dolly Out | 906b93f2-beb3-42be-9283-92236cc90ed6 | WAN21 | 0.9 | \-2 to 2 |
| Golden Age Cinema | 441054b6-2432-412a-8965-0225867638c1 | WAN21 | 1 | \-2 to 2 |
| Infrared Photography | 82d12da5-ae30-4d0f-9a3f-0a35d74e487c | SDXL\_1\_0 | 0.8 | \-2 to 2 |
| Simple Icons | ec024a37-6fab-41ba-bc03-ab29ae0b9b5a | SDXL\_1\_0 | 1 | \-2 to 2 |
| Orbit Left | 74bea0cc-9942-4d45-9977-28c25078bfd4 | WAN21 | 1 | \-2 to 2 |
| Cardboard | 38641346-9360-4122-b721-49eef528502e | FLUX\_DEV | 1 | \-2 to 2 |
| Porcelain | 19f3fcf0-ee0a-4cab-a174-4ac2d032f617 | FLUX\_DEV | 1 | \-2 to 2 |
| Inkflow | aab9138e-40df-45cd-bc4a-8e32bf729854 | WAN21 | 1 | \-2 to 2 |
| Handheld | 75722d13-108f-4cea-9471-cb7e5fc049fe | WAN21 | 0.9 | \-2 to 2 |
| Vintage Black & White | 4179f8bd-ae74-47c8-974c-212691acde29 | WAN21 | 1 | \-2 to 2 |
| Tilt Down | a1923b1b-854a-46a1-9e26-07c435098b87 | WAN21 | 1 | \-2 to 2 |
| Vintage Photography | 6e37fc81-eed7-4ae7-aa86-d4b719b2f098 | SDXL\_1\_0 | 1 | \-2 to 2 |
| Chrome | 8a526c02-8dc0-4038-8c7e-544c3d34726b | FLUX\_DEV | 1 | \-2 to 2 |
| Soft Pastel Anime (Flux) | 27e28f9e-7431-44c8-b42a-98bcec4814c4 | FLUX\_DEV | 1 | \-2 to 2 |
| Moody Realism | b46deca6-b1fc-4798-b8f0-1916aef1ad81 | WAN21 | 1 | \-2 to 2 |
| Lens Crack | 193da194-2632-4f6a-a1df-d03ca9ae0ea9 | WAN21 | 1.2 | \-2 to 2 |
| Rough Sketch | 1b900d40-e593-4abb-92b5-04ce96403a44 | FLUX\_DEV | 1 | \-2 to 2 |
| Dark Arts | 5db13b9c-0b0b-4684-87ca-01f59c97aae0 | SDXL\_1\_0 | 1 | \-2 to 2 |
| Oldschool Comic (WAN21) | 53d80166-fd48-42a6-9c94-f47482d0808f | WAN21 | 1 | \-2 to 2 |
| Crash Zoom Out | 1975ac74-92ca-46b3-81b3-6f191a9ae438 | WAN21 | 1 | \-2 to 2 |
| Grunge | 3dfa7774-1481-4ece-9fa3-d89c7ca35943 | FLUX\_DEV | 1 | \-2 to 2 |
| Cute Emotes | d3a193ba-c69f-47d2-8759-583a729a2f26 | SDXL\_1\_0 | 1 | \-2 to 2 |
| Old VHS | 5d4de76c-5545-40de-ae7d-f7b4f73fe187 | WAN21 | 1 | \-2 to 2 |
| Super Dolly In | a3992d78-34fc-44c6-b157-e2755d905197 | WAN21 | 0.9 | \-2 to 2 |
| Simple Flat Animation | 05667d3a-f47f-441c-9653-e13c0744129b | WAN21 | 1 | \-2 to 2 |
| Bullet Time | fbed015e-594e-4f78-b4be-3b07142aaa1e | WAN21 | 1 | \-2 to 2 |
| Dolly In | ece8c6a9-3deb-430e-8c93-4d5061b6adbf | WAN21 | 1.2 | \-2 to 2 |
| Dolly Left | f507880a-3fa8-4c3a-96bb-3ce3b70ac53b | WAN21 | 1 | \-2 to 2 |
| Dolly Right | 587a0109-30be-4781-a18e-e353b580fd10 | WAN21 | 1 | \-2 to 2 |
| Soft Infrared | 51ea1289-394d-4b2c-9fcc-feffa0292193 | WAN21 | 1 | \-2 to 2 |
| Crane Over Head | 1054d533-168c-4821-bd3d-a56182afa4f3 | WAN21 | 1 | \-2 to 2 |
| Stylized 3Dtoon | b295930d-625b-4490-9580-fca498568231 | WAN21 | 1 | \-2 to 2 |
| Y2K Analog | 4abcbeef-c9ed-48bd-b270-48ad1dfc16e9 | WAN21 | 1 | \-2 to 2 |
| Explosion | 65da803d-c015-495a-8d5c-e969a79c9894 | WAN21 | 1 | \-2 to 2 |
| Dolly Out | 772cb36a-7d18-4250-b4aa-0c3f1a8431a0 | WAN21 | 1 | \-2 to 2 |
| Crane Down | 5a1d2a6a-7709-4097-9158-1b7ae6c9e647 | WAN21 | 1 | \-2 to 2 |
| Disintegration | a51e2e8d-ba5e-44f2-9e00-3d86fd93c9bc | WAN21 | 1 | \-2 to 2 |
| Orbit Right | aec24e36-a2e8-4fae-920c-127d276bbe4b | WAN21 | 1 | \-2 to 2 |
| Tilt Up | 6ad6de1f-bd15-4d0b-ae0e-81d1a4c6c085 | WAN21 | 1 | \-2 to 2 |
| Synthwave | 427fe84f-a3fa-4d9f-b780-124165e435ed | WAN21 | 1 | \-2 to 2 |


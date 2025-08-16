# Workflow Builder: Node & System Specification

## 1. Introduction

This document provides a technical overview of the components, data structures, and rules that govern the Workflow Builder application. The system is designed around a node-based graph architecture where users can visually connect different processing steps to create complex AI media generation pipelines.

## 2. Core Data Structures

The application's state is managed by a few key data structures.

| Structure | File | Description |
| :--- | :--- | :--- |
| `NodeData` | `types.ts` | Represents an instance of a node placed on the canvas. It holds the node's unique ID, position, and its current configuration. |
| `NodeType` | `types.ts` | A template or definition for a type of node (e.g., "Image Generation"). It defines the node's name, appearance, inputs, outputs, and default settings. |
| `Connection` | `types.ts` | Represents a directed link between an output connector of one node and an input connector of another. |
| `ConnectorDefinition` | `types.ts`| Defines an input or output port on a `NodeType`, specifying its name and the data type it handles. |

### 2.1. `NodeData`

```typescript
interface NodeData {
  id: string; // Unique identifier (e.g., "node-1678886400000")
  typeKey: string; // Key referencing a NodeType (e.g., "image-generation")
  position: { x: number; y: number }; // Position on the canvas
  settings: Record<string, any>; // Current settings values for the node instance
  exposedConnectors?: { [connectorName: string]: number }; // Tracks how many multi-input slots are visible
  status?: 'idle' | 'running' | 'completed' | 'failed'; // The execution status of the node
  outputData?: any; // Stores the result from the API call after completion
}
```

### 2.2. `NodeType`

```typescript
interface NodeType {
  name: string; // User-facing name (e.g., "Image Generation")
  color: string; // TailwindCSS background color class for the header
  category?: string; // Grouping for the "Add Step" menu (e.g., "Inputs")
  description?: string; // Short explanation of the node's function for menus.
  icon?: React.FC; // Icon component for the header
  inputs: ConnectorDefinition[]; // Array of input connector definitions
  outputs: ConnectorDefinition[]; // Array of output connector definitions
  defaultSettings?: Record<string, any>; // Default values for the settings panel
  models?: string[]; // Optional list of models for a dropdown
}
```

## 3. Workflow Execution System

The application can execute the visual workflow by making calls to the Leonardo.ai API.

### 3.1. API Configuration

*   **API Key**: The user must provide a Leonardo.ai API key. This is managed through a **Settings** modal, accessible from the main header. The key is stored securely in the browser's `localStorage`.

### 3.2. Execution Flow

1.  **Initiation**: The user clicks the **"Run Workflow"** button in the header.
2.  **Topological Sort**: The system performs a topological sort on the node graph to determine a linear execution order, ensuring that each node runs only after its dependencies have completed. If a cycle is detected, the execution is halted.
3.  **Sequential Execution**: The system iterates through the sorted nodes one by one.
    *   The node's `status` is set to `'running'`, and a visual indicator appears on the node.
    *   The system gathers all necessary inputs for the current node from the `outputData` of its parent nodes.
    *   An API request is constructed based on the node's type, its settings, and the gathered inputs.
    *   For asynchronous operations (like image generation), the system initiates the job and then polls a status endpoint until the job is `COMPLETE` or `FAILED`.
4.  **Completion/Failure**:
    *   Upon success, the node's `status` is set to `'completed'`, and the results (e.g., image URLs) are stored in its `outputData` field. The generated media is displayed directly on the node and in the Generations panel.
    *   If an error occurs, the `status` is set to `'failed'`, and an error icon is displayed.

### 3.3. Generations Panel

*   A dedicated **Generations** panel is accessible from the header.
*   This panel acts as a gallery, collecting and displaying all final media outputs from the most recent workflow run.

## 4. Connection System

Connections are the wires that link nodes, allowing data to flow through the workflow.

### 4.1. Connection Data Types

There are three fundamental data types that can be passed between nodes:

*   `text`: Represents a string of text. Color: **Blue**.
*   `image`: Represents an image file. Color: **Violet**.
*   `video`: Represents a video file. Color: **Green**.

### 4.2. Connection Rules

1.  **Type Matching**: A connection can only be made between an output and an input of the **same data type**.
2.  **Directionality**: Connections must flow from an `output` to an `input`.
3.  **Input Singularity**: A standard input connector can only accept **one** incoming connection. If a new connection is made to an already-connected input, the old connection is automatically removed.
4.  **Output Multiplicity**: An output connector can have **multiple** connections originating from it, allowing its data to be fed into several other nodes simultaneously.
5.  **Self-Connection**: A node cannot be connected to itself.

### 4.3. Special Connector Behaviors

*   **Multi-Input Connectors**: Some nodes have inputs that can accept multiple connections (e.g., "Image Input" on the Image Generation node).
    *   These are defined in the `NodeType` with a `count` property (e.g., `count: 6`).
    *   They start by exposing one input slot (e.g., "Image Input 1").
    *   A `+` button appears on the node to manually expose additional slots up to the defined `count`.
    *   When a connection is made to the last available slot, the next slot is automatically exposed.
*   **Dynamic Output Connectors**: Some nodes can have a variable number of outputs based on their settings.
    *   The **Image Generation** and **Video Generation** nodes dynamically create output connectors based on the `numImages` or `numVideos` setting, respectively. For example, if `numImages` is set to 3, three outputs will appear: "Image 1", "Image 2", and "Image 3".

## 5. Node Specifications

This section details each available node type.

---

### 5.1. Input Nodes

Input nodes are the starting points of a workflow, used to provide initial data like text prompts or media files.

#### 5.1.1. Text (`input-text`)

Provides a string of text to other nodes.

*   **Inputs**: None
*   **Outputs**:
    | Name | Type | Description |
    | :--- | :--- |:---|
    | Text | `text` | The configured text content. |
*   **Settings**:
    | Setting Key | UI Control | Description |
    | :--- | :--- | :--- |
    | `text` | Text Area | The text content to be output by the node. |
    | `exposeAsInput` | Toggle | (For future use) Marks this field to be shown to an end-user. |
    | `instructions`| Text Area | (For future use) Instructions for the end-user if exposed. |

#### 5.1.2. Image (`input-image`)

Provides an image file to other nodes.

*   **Inputs**: None
*   **Outputs**:
    | Name | Type | Description |
    | :--- | :--- |:---|
    | Image | `image` | The uploaded image file. |
*   **Settings**:
    | Setting Key | UI Control | Description |
    | :--- | :--- | :--- |
    | `src` | File Upload | The source URL of the uploaded image. |
    | `fileName` | - | The name of the uploaded file. |
    | `exposeAsInput` | Toggle | (For future use) Marks this field to be shown to an end-user. |
    | `instructions`| Text Area | (For future use) Instructions for the end-user if exposed. |

#### 5.1.3. Video (`input-video`)

Provides a video file to other nodes.

*   **Inputs**: None
*   **Outputs**:
    | Name | Type | Description |
    | :--- | :--- |:---|
    | Video | `video` | The uploaded video file. |
*   **Settings**:
    | Setting Key | UI Control | Description |
    | :--- | :--- | :--- |
    | `src` | File Upload | The source URL of the uploaded video. |
    | `fileName` | - | The name of the uploaded file. |
    | `exposeAsInput` | Toggle | (For future use) Marks this field to be shown to an end-user. |
    | `instructions`| Text Area | (For future use) Instructions for the end-user if exposed. |

---

### 5.2. Primary Nodes

Primary nodes perform the core AI generation and processing tasks.

#### 5.2.1. Image Generation (`image-generation`)

Generates images from text prompts and optional reference images.

*   **Inputs**:
    | Name | Type | Multi-Input | Description |
    | :--- | :--- |:--- |:---|
    | Prompt | `text` | No | The primary text description for the image generation. |
    | Negative Prompt | `text` | No | Text description of elements to exclude from the image. |
    | Image Input | `image` | Yes (max 6) | Reference images to influence the generation. |
*   **Outputs**:
    | Name | Type | Description |
    | :--- | :--- |:---|
    | Image | `image` | The generated image(s). The number of outputs is dynamic. |
*   **Settings**:
    | Setting Key | UI Control | Description |
    | :--- | :--- | :--- |
    | `model` | Dropdown | The AI model to use for generation. |
    | `style` | Dropdown | The artistic style to apply to the generated image. |
    | `numImages`| Range Slider (1-10) | The number of images to generate, which determines the number of output connectors. |
    | `aspectRatio`| Dropdown | The width-to-height ratio of the output image. |
    | `seed`| Number Input | A specific seed for reproducible results. Leave blank for random. |
*   **Models**: `Leonardo Diffusion XL`, `Leonardo Kino XL`, `Leonardo Vision XL`, etc.

#### 5.2.2. Video Generation (`video-generation`)

Generates videos from text prompts and optional reference media.

*   **Inputs**:
    | Name | Type | Multi-Input | Description |
    | :--- | :--- |:--- |:---|
    | Prompt | `text` | No | The primary text description for the video generation. |
    | Negative Prompt | `text` | No | Text description of elements to exclude from the video. |
    | Image Input | `image` | Yes (max 6) | Reference images to influence the generation. |
    | Video Input | `video` | Yes (max 6) | Reference videos to influence the generation. |
*   **Outputs**:
    | Name | Type | Description |
    | :--- | :--- |:---|
    | Video | `video` | The generated video(s). The number of outputs is dynamic. |
*   **Settings**:
    | Setting Key | UI Control | Description |
    | :--- | :--- | :--- |
    | `model` | Dropdown | The AI model to use for generation. |
    | `numVideos`| Range Slider (1-10) | The number of videos to generate, which determines the number of output connectors. |
    | `aspectRatio`| Dropdown | The width-to-height ratio of the output video. |
    | `seed`| Number Input | A specific seed for reproducible results. Leave blank for random. |
*   **Models**: `Veo 3`, `Veo 2`, `Motion 2.0`, `Motion 1.0`, `Lucid Dream`.

#### 5.2.3. Image Edit (`image-edit`)

Edits an existing image based on a text prompt.

*   **Inputs**:
    | Name | Type | Multi-Input | Description |
    | :--- | :--- |:--- |:---|
    | Prompt | `text` | No | The text instructions for how to edit the image. |
    | Image to Edit | `image` | No | The source image to be modified. |
*   **Outputs**:
    | Name | Type | Description |
    | :--- | :--- |:---|
    | Image | `image` | The edited image. |
*   **Settings**:
    | Setting Key | UI Control | Description |
    | :--- | :--- | :--- |
    | `seed`| Number Input | A specific seed for reproducible results. Leave blank for random. |

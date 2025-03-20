import { AIHordeClient } from "./client";

// Use the global fetch API instead of node-fetch
// This avoids the type declaration issue

export interface ModelReference {
    name: string;
    baseline: string;
    optimization?: string;
    type: string;
    inpainting: boolean;
    description: string;
    version: string;
    style?: string;
    homepage?: string;
    nsfw: boolean;
    download_all: boolean;
    requirements: {
        min_steps: number;
        max_steps: number;
        cfg_scale: number;
        samplers: string[];
        schedulers: string[];
    };
}

export interface ModelReferenceData {
    [key: string]: ModelReference;
}

export class ModelReferenceManager {
    private modelReferences: ModelReferenceData = {};
    private modelNameMap: Map<string, string> = new Map(); // Maps normalized names to exact reference names
    private lastFetched: number = 0;
    private fetchInterval: number = 1000 * 60 * 60; // 1 hour

    constructor(private client: AIHordeClient) {}

    /**
     * Fetches model reference data from GitHub
     */
    async fetchModelReferences(): Promise<ModelReferenceData> {
        try {
            const now = Date.now();
            if (now - this.lastFetched < this.fetchInterval && Object.keys(this.modelReferences).length > 0) {
                return this.modelReferences;
            }

            // Use the model reference source from config or default to GitHub URL
            const repoUrl = this.client.config.data_sources?.model_reference_source || 
                "https://raw.githubusercontent.com/AIPowerGrid/image-model-reference/main/stable_diffusion.json";
            
            const response = await fetch(repoUrl);
            
            if (!response.ok) {
                console.error(`Failed to fetch model reference: ${response.status} ${response.statusText}`);
                return this.modelReferences;
            }

            const data = await response.json() as ModelReferenceData;
            this.modelReferences = data;
            this.lastFetched = now;
            
            // Build normalized name mapping for fuzzy matching
            this.buildModelNameMap();
            
            if (this.client.config.advanced?.dev) {
                console.log(`Fetched ${Object.keys(this.modelReferences).length} model references`);
            }
            
            return this.modelReferences;
        } catch (error) {
            console.error("Error fetching model references:", error);
            return this.modelReferences;
        }
    }

    /**
     * Builds a map of normalized model names to exact reference names
     * This helps with fuzzy matching model names
     */
    private buildModelNameMap(): void {
        this.modelNameMap.clear();
        
        for (const [refName, modelData] of Object.entries(this.modelReferences)) {
            // Add the exact name
            this.modelNameMap.set(this.normalizeModelName(refName), refName);
            
            // Also add the name from the model data if it exists and is different
            if (modelData.name && modelData.name !== refName) {
                this.modelNameMap.set(this.normalizeModelName(modelData.name), refName);
            }
        }
    }

    /**
     * Normalizes a model name for better matching
     */
    private normalizeModelName(name: string): string {
        return name.toLowerCase()
            .replace(/[-_\s]+/g, '') // Remove spaces, underscores, hyphens
            .replace(/[^\w\d]/g, ''); // Remove non-alphanumeric characters
    }

    /**
     * Gets reference data for a specific model
     * Uses fuzzy matching to find the best match
     */
    async getModelReference(modelName: string): Promise<ModelReference | null> {
        if (!modelName) return null;
        
        // Ensure we have the latest data
        await this.fetchModelReferences();
        
        // Try direct lookup first
        if (this.modelReferences[modelName]) {
            return this.modelReferences[modelName];
        }
        
        // Try normalized name lookup
        const normalizedName = this.normalizeModelName(modelName);
        const referenceKey = this.modelNameMap.get(normalizedName);
        
        if (referenceKey && this.modelReferences[referenceKey]) {
            return this.modelReferences[referenceKey];
        }
        
        // Try partial matching
        for (const [mappedNormName, refKey] of this.modelNameMap.entries()) {
            if (mappedNormName.includes(normalizedName) || normalizedName.includes(mappedNormName)) {
                if (this.modelReferences[refKey]) {
                    return this.modelReferences[refKey];
                }
            }
        }
        
        return null;
    }

    /**
     * Applies model reference constraints to generation parameters
     */
    async applyModelReferenceConstraints(
        modelName: string, 
        generationParams: any
    ): Promise<any> {
        if (!modelName) return generationParams;
        
        const modelRef = await this.getModelReference(modelName);
        if (!modelRef) return generationParams;
        
        const updatedParams = { ...generationParams };
        
        // Apply steps constraints
        if (modelRef.requirements.min_steps && modelRef.requirements.max_steps) {
            const currentSteps = updatedParams.steps || 30; // Default to 30 if not specified
            
            if (currentSteps < modelRef.requirements.min_steps) {
                updatedParams.steps = modelRef.requirements.min_steps;
            } else if (currentSteps > modelRef.requirements.max_steps) {
                updatedParams.steps = modelRef.requirements.max_steps;
            }
        }
        
        // Apply cfg_scale constraint
        if (modelRef.requirements.cfg_scale !== undefined) {
            updatedParams.cfg_scale = modelRef.requirements.cfg_scale;
        }
        
        // Apply sampler constraint if samplers are specified
        if (modelRef.requirements.samplers && modelRef.requirements.samplers.length > 0) {
            // If the current sampler isn't in the allowed list, use the first allowed one
            const currentSampler = updatedParams.sampler_name;
            if (!currentSampler || !modelRef.requirements.samplers.includes(currentSampler)) {
                updatedParams.sampler_name = modelRef.requirements.samplers[0];
            }
        }
        
        // Apply scheduler constraints
        if (modelRef.requirements.schedulers && modelRef.requirements.schedulers.length > 0) {
            // Currently the horde API uses karras/normal/simple as strings in params
            // Map reference scheduler names to horde API param values
            // For now, assume 'karras' in the model reference means to set karras=true
            if (modelRef.requirements.schedulers.includes('karras')) {
                updatedParams.karras = true;
            }
        }
        
        return updatedParams;
    }
}

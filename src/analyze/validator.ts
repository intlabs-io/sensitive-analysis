import type { SensitiveEntity, ValidationConfig } from '../types';

/**
 * Validator: Filters and validates sensitive entities based on confidence thresholds
 * and policy requirements
 */
export class ValidatorTool {
  private config: Required<ValidationConfig>;

  constructor(config: ValidationConfig = {}) {
    const defaultConfig: Required<ValidationConfig> = {
      minimumConfidence: 7,
      enableStrictMode: false,
    };

    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Validate a batch of entities
   */
  async validateEntities(
    entities: SensitiveEntity[],
  ): Promise<SensitiveEntity[]> {
    return entities.filter((entity) => this.isValidEntity(entity));
  }

  /**
   * Validate a single entity
   */
  validateSingle(entity: SensitiveEntity): boolean {
    return this.isValidEntity(entity);
  }

  /**
   * Check if an entity meets validation criteria
   */
  private isValidEntity(entity: SensitiveEntity): boolean {
    // Basic validation checks
    if (entity.confidence < this.config.minimumConfidence) return false;

    // Strict mode additional checks
    if (this.config.enableStrictMode) {
      if (!entity.entity || entity.entity.trim().length === 0) return false;
      if (entity.confidence < 8) return false; // Higher threshold in strict mode
    }

    return true;
  }

  /**
   * Update validation configuration
   */
  updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current validation configuration
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }

  /**
   * Get validation statistics for a batch of entities
   */
  getValidationStats(entities: SensitiveEntity[]): {
    total: number;
    valid: number;
    invalid: number;
    validationRate: number;
  } {
    const valid = entities.filter((entity) => this.isValidEntity(entity));
    const total = entities.length;
    const validCount = valid.length;
    const invalid = total - validCount;

    return {
      total,
      valid: validCount,
      invalid,
      validationRate: total > 0 ? validCount / total : 0,
    };
  }
}

// Export default instance
export const validatorTool = new ValidatorTool();

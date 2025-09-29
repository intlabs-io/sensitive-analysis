import type { SensitiveEntity, UnstructuredSensitiveEntity } from '../types';
import { ValidatorTool } from './validator';

describe('ValidatorTool', () => {
  let validator: ValidatorTool;

  beforeEach(() => {
    validator = new ValidatorTool();
  });

  describe('entity validation', () => {
    it('should validate entities with confidence above minimum threshold', async () => {
      const entities: UnstructuredSensitiveEntity[] = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          text: 'john@example.com',
        },
        {
          entity: 'phone',
          reference: 'policy1',
          confidence: 6,
          rankHex: '0x2',
          text: '555-1234',
        },
        {
          entity: 'name',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x3',
          text: 'John Doe',
        },
      ];

      const result = await validator.validateEntities(
        entities as SensitiveEntity[],
      );

      expect(result).toHaveLength(2);
      expect(
        result.find(
          (e) => (e as UnstructuredSensitiveEntity).text === 'john@example.com',
        ),
      ).toBeDefined();
      expect(
        result.find(
          (e) => (e as UnstructuredSensitiveEntity).text === 'John Doe',
        ),
      ).toBeDefined();
      expect(
        result.find(
          (e) => (e as UnstructuredSensitiveEntity).text === '555-1234',
        ),
      ).toBeUndefined();
    });

    it('should validate single entity correctly', () => {
      const validEntity: UnstructuredSensitiveEntity = {
        entity: 'email',
        reference: 'policy1',
        confidence: 8,
        rankHex: '0x1',
        text: 'john@example.com',
      };

      const invalidEntity: UnstructuredSensitiveEntity = {
        entity: 'email',
        reference: 'policy1',
        confidence: 5,
        rankHex: '0x2',
        text: 'low@confidence.com',
      };

      expect(validator.validateSingle(validEntity)).toBe(true);
      expect(validator.validateSingle(invalidEntity)).toBe(false);
    });

    it('should handle empty entity array', async () => {
      const result = await validator.validateEntities([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('configuration management', () => {
    it('should use default configuration when none provided', () => {
      const config = validator.getConfig();
      expect(config.minimumConfidence).toBe(7);
      expect(config.enableStrictMode).toBe(false);
    });

    it('should use custom configuration', () => {
      const customValidator = new ValidatorTool({
        minimumConfidence: 8,
        enableStrictMode: true,
      });

      const config = customValidator.getConfig();
      expect(config.minimumConfidence).toBe(8);
      expect(config.enableStrictMode).toBe(true);
    });

    it('should update configuration correctly', () => {
      validator.updateConfig({ minimumConfidence: 9 });
      expect(validator.getConfig().minimumConfidence).toBe(9);
    });

    it('should return immutable configuration', () => {
      const config = validator.getConfig();
      const originalMinimum = config.minimumConfidence;
      config.minimumConfidence = 999;

      const configAgain = validator.getConfig();
      expect(configAgain.minimumConfidence).toBe(originalMinimum);
    });
  });

  describe('validation statistics', () => {
    it('should provide accurate validation statistics', () => {
      const entities: UnstructuredSensitiveEntity[] = [
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 8,
          rankHex: '0x1',
          text: 'valid@example.com',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 6,
          rankHex: '0x2',
          text: 'invalid@example.com',
        },
        {
          entity: 'email',
          reference: 'policy1',
          confidence: 9,
          rankHex: '0x3',
          text: 'another@example.com',
        },
      ];

      const stats = validator.getValidationStats(entities as SensitiveEntity[]);

      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(2);
      expect(stats.invalid).toBe(1);
      expect(stats.validationRate).toBeCloseTo(0.667, 2);
    });

    it('should handle empty arrays in statistics', () => {
      const stats = validator.getValidationStats([]);

      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.invalid).toBe(0);
      expect(stats.validationRate).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle entities with exactly minimum confidence', () => {
      const entity: UnstructuredSensitiveEntity = {
        entity: 'email',
        reference: 'policy1',
        confidence: 7, // Exactly minimum
        rankHex: '0x1',
        text: 'boundary@example.com',
      };

      expect(validator.validateSingle(entity)).toBe(true);
    });

    it('should handle entities with confidence just below minimum', () => {
      const entity: UnstructuredSensitiveEntity = {
        entity: 'email',
        reference: 'policy1',
        confidence: 6.99, // Just below minimum
        rankHex: '0x1',
        text: 'boundary@example.com',
      };

      expect(validator.validateSingle(entity)).toBe(false);
    });

    it('should handle very high confidence entities', () => {
      const entity: UnstructuredSensitiveEntity = {
        entity: 'email',
        reference: 'policy1',
        confidence: 10,
        rankHex: '0x1',
        text: 'perfect@example.com',
      };

      expect(validator.validateSingle(entity)).toBe(true);
    });
  });

  describe('partial configuration updates', () => {
    it('should update only specified configuration fields', () => {
      const initialConfig = validator.getConfig();

      validator.updateConfig({ minimumConfidence: 8 });

      const updatedConfig = validator.getConfig();
      expect(updatedConfig.minimumConfidence).toBe(8);
      expect(updatedConfig.enableStrictMode).toBe(
        initialConfig.enableStrictMode,
      );
    });

    it('should update strict mode independently', () => {
      const initialConfig = validator.getConfig();

      validator.updateConfig({ enableStrictMode: true });

      const updatedConfig = validator.getConfig();
      expect(updatedConfig.enableStrictMode).toBe(true);
      expect(updatedConfig.minimumConfidence).toBe(
        initialConfig.minimumConfidence,
      );
    });
  });
});

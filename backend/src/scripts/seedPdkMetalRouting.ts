import { PdkModuleModel } from '../models/PdkModule';

const PDK_MODULES = [
  {
    name: 'PDK_28nm_STD',
    technologyNode: '28nm',
    notes: 'Standard 28nm PDK reference module',
    metals: [
      { metalType: 'MET1', currentDensityAt110: 0.85, sheetResistance: 0.12 },
      { metalType: 'MET2', currentDensityAt110: 1.1, sheetResistance: 0.08 },
      { metalType: 'MET3', currentDensityAt110: 1.45, sheetResistance: 0.05 },
      { metalType: 'MET4', currentDensityAt110: 2.0, sheetResistance: 0.035 },
    ],
  },
  {
    name: 'PDK_28nm_PWR',
    technologyNode: '28nm',
    notes: 'Power-focused PDK module',
    metals: [
      { metalType: 'MET2', currentDensityAt110: 1.25, sheetResistance: 0.075 },
      { metalType: 'MET3', currentDensityAt110: 1.8, sheetResistance: 0.042 },
      { metalType: 'MET4', currentDensityAt110: 2.4, sheetResistance: 0.03 },
      { metalType: 'MET5', currentDensityAt110: 2.9, sheetResistance: 0.025 },
    ],
  },
  {
    name: 'PDK_40nm_LEGACY',
    technologyNode: '40nm',
    notes: 'Legacy node — same metal names, different values',
    metals: [
      { metalType: 'MET1', currentDensityAt110: 0.7, sheetResistance: 0.15 },
      { metalType: 'MET2', currentDensityAt110: 0.95, sheetResistance: 0.1 },
      { metalType: 'MET3', currentDensityAt110: 1.2, sheetResistance: 0.065 },
      { metalType: 'MET4', currentDensityAt110: 1.6, sheetResistance: 0.045 },
    ],
  },
];

export async function seedPdkMetalRouting(): Promise<{ modulesCreated: number }> {
  let modulesCreated = 0;

  for (const mod of PDK_MODULES) {
    const existing = await PdkModuleModel.findOne({ name: mod.name });
    if (!existing) {
      await PdkModuleModel.create(mod);
      modulesCreated += 1;
    }
  }

  return { modulesCreated };
}

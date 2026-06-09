import { PkaModuleModel } from '../models/PkaModule';
import { ProjectCellModel } from '../models/ProjectCell';

const PKA_MODULES = [
  {
    name: 'PKA_28nm_STD',
    technologyNode: '28nm',
    notes: 'Standard 28nm PKA reference module',
    metals: [
      { metalType: 'MET1', currentDensityAt110: 0.85, sheetResistance: 0.12 },
      { metalType: 'MET2', currentDensityAt110: 1.1, sheetResistance: 0.08 },
      { metalType: 'MET3', currentDensityAt110: 1.45, sheetResistance: 0.05 },
      { metalType: 'MET4', currentDensityAt110: 2.0, sheetResistance: 0.035 },
    ],
  },
  {
    name: 'PKA_28nm_PWR',
    technologyNode: '28nm',
    notes: 'Power-focused PKA module',
    metals: [
      { metalType: 'MET2', currentDensityAt110: 1.25, sheetResistance: 0.075 },
      { metalType: 'MET3', currentDensityAt110: 1.8, sheetResistance: 0.042 },
      { metalType: 'MET4', currentDensityAt110: 2.4, sheetResistance: 0.03 },
      { metalType: 'MET5', currentDensityAt110: 2.9, sheetResistance: 0.025 },
    ],
  },
  {
    name: 'PKA_40nm_LEGACY',
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

export async function seedPkaMetalRouting(): Promise<{ modulesCreated: number; modulesUpdated: number }> {
  let modulesCreated = 0;
  let modulesUpdated = 0;

  // Remove legacy flat PKA documents (pre–sheet-2-table schema)
  await PkaModuleModel.deleteMany({
    $or: [{ metals: { $exists: false } }, { metals: { $size: 0 } }],
  });
  await PkaModuleModel.deleteMany({
    name: { $in: ['M1_STD', 'M2_STD', 'M3_THICK', 'M4_PWR', 'M5_TOP'] },
  });

  for (const mod of PKA_MODULES) {
    const existing = await PkaModuleModel.findOne({ name: mod.name });
    if (!existing) {
      await PkaModuleModel.create(mod);
      modulesCreated += 1;
    } else if (!existing.metals?.length) {
      existing.metals = mod.metals;
      existing.technologyNode = mod.technologyNode;
      existing.notes = mod.notes;
      await existing.save();
      modulesUpdated += 1;
    }
  }

  // Ensure at least some cells exist for practical dropdowns
  const cellCount = await ProjectCellModel.countDocuments();
  if (cellCount === 0) {
    // Cells are created via project workspace; no-op here
  }

  return { modulesCreated, modulesUpdated };
}

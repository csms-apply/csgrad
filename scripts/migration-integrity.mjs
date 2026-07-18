export function assessMigrationIntegrity({
  sourceDatapoints,
  emittedDatapoints,
  orphanNoApplicant,
  orphanNoProgram,
  orphanBoth = 0,
  allowSkips = false,
}) {
  const skippedDatapoints = sourceDatapoints - emittedDatapoints;
  const classifiedOrphans = orphanNoApplicant + orphanNoProgram + orphanBoth;
  const complete = skippedDatapoints === 0 && classifiedOrphans === 0;
  const counts = `source=${sourceDatapoints} emitted=${emittedDatapoints} skipped=${skippedDatapoints}`;

  if (skippedDatapoints !== classifiedOrphans) {
    return {
      ok: false,
      overridden: false,
      skippedDatapoints,
      message: `INCONSISTENT: ${counts} classified=${classifiedOrphans}`,
    };
  }

  if (complete) {
    return {
      ok: true,
      overridden: false,
      skippedDatapoints,
      message: `COMPLETE: ${counts}`,
    };
  }

  if (allowSkips) {
    return {
      ok: true,
      overridden: true,
      skippedDatapoints,
      message: `INCOMPLETE/OVERRIDDEN: ${counts}`,
    };
  }

  return {
    ok: false,
    overridden: false,
    skippedDatapoints,
    message: `INCOMPLETE: ${counts}; rerun with --allow-skips only after reviewing every orphan`,
  };
}

export function parseAllowSkips(argv) {
  const unknown = argv.filter((arg) => arg !== '--allow-skips');
  if (unknown.length > 0) {
    throw new Error(`unknown argument(s): ${unknown.join(', ')}`);
  }
  return argv.includes('--allow-skips');
}

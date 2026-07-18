export function assessMigrationIntegrity({
  sourceDatapoints,
  expectedDatapoints,
  emittedDatapoints,
  orphanNoApplicant,
  orphanNoProgram,
  orphanBoth = 0,
  blockingReviewItems = 0,
  allowSkips = false,
}) {
  const skippedDatapoints = sourceDatapoints - emittedDatapoints;
  const classifiedOrphans = orphanNoApplicant + orphanNoProgram + orphanBoth;
  const sourceMatchesExpected = sourceDatapoints === expectedDatapoints;
  const complete = sourceMatchesExpected
    && skippedDatapoints === 0
    && classifiedOrphans === 0
    && blockingReviewItems === 0;
  const counts = `source=${sourceDatapoints} emitted=${emittedDatapoints} skipped=${skippedDatapoints}`;

  if (skippedDatapoints !== classifiedOrphans) {
    return {
      ok: false,
      overridden: false,
      skippedDatapoints,
      message: `INCONSISTENT: ${counts} classified=${classifiedOrphans}`,
    };
  }

  if (!sourceMatchesExpected && !allowSkips) {
    return {
      ok: false,
      overridden: false,
      skippedDatapoints,
      message: `SOURCE_MISMATCH: ${counts} expected=${expectedDatapoints}`,
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
      message: `INCOMPLETE/OVERRIDDEN: ${counts} expected=${expectedDatapoints} blocking_review=${blockingReviewItems}`,
    };
  }

  return {
    ok: false,
    overridden: false,
    skippedDatapoints,
    message: `INCOMPLETE: ${counts} expected=${expectedDatapoints} blocking_review=${blockingReviewItems}; rerun with --allow-skips only after reviewing every blocking item`,
  };
}

export function parseAllowSkips(argv) {
  const unknown = argv.filter((arg) => arg !== '--allow-skips');
  if (unknown.length > 0) {
    throw new Error(`unknown argument(s): ${unknown.join(', ')}`);
  }
  return argv.includes('--allow-skips');
}

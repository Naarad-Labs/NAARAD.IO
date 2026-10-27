/* The features and feature log validation and dashboard export.
 *
 * G2 and G4 may be 'required': the gate applies and nobody has yet proposed or
 * approved anything. That is different from 'not-required' and is shown as such.
 *
 * This module implements the rules for feature lifecycle, gates, and log events.
 * It is deterministic, does not read the clock or the network, and uses
 * node:fs to verify that referenced files exist.
 */

import fs from 'node:fs';
import path from 'node:path';

export const STATUSES = ['idea', 'designed', 'building', 'flagged', 'live', 'removed'];
export const EVENTS = ['created', 'status', 'gate', 'decision', 'release', 'note'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const PERSONAL_PATTERNS = [
  ['email address', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ['phone number', /(?:\+?91[\s-]?)?\b[6-9]\d{9}\b/],
];

function isRealDate(value, today) {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;
  if (!today) return true;
  const latest = new Date(`${today}T00:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() + 1);
  return value <= latest.toISOString().slice(0, 10);
}

export function validateFeatures(features, ctx) {
  const errors = [];
  const seenIds = new Set();

  for (const f of features) {
    const id = f.id;
    const fail = (field, msg) => {
      errors.push(`${id}: ${field} - ${msg}`);
    };

    if (typeof id !== 'string' || !/^F-\d{3}$/.test(id)) {
      errors.push(`${id || 'unknown'}: id must look like F-nnn`);
      continue;
    }

    if (seenIds.has(id)) {
      fail('id', 'duplicate id');
      continue;
    }
    seenIds.add(id);

    if (typeof f.name !== 'string' || f.name.trim() === '') {
      fail('name', 'name is required and must be non-empty');
    }
    if (typeof f.area !== 'string' || f.area.trim() === '') {
      fail('area', 'area is required and must be non-empty');
    }
    if (typeof f.summary !== 'string' || f.summary.trim() === '') {
      fail('summary', 'summary is required and must be non-empty');
    }
    if (!STATUSES.includes(f.status)) {
      fail('status', `status must be one of ${STATUSES.join(', ')}`);
    }

    if (f.status === 'flagged') {
      if (typeof f.flag !== 'string' || f.flag.trim() === '') {
        fail('flag', 'flagged feature must have a non-empty flag');
      }
    } else if (['live', 'idea', 'designed'].includes(f.status)) {
      if (f.flag !== null) {
        fail('flag', 'live, idea, or designed feature must have flag null');
      }
    }

    if (!['pre-os', 'built-under-override', 'planned'].includes(f.origin)) {
      fail('origin', 'origin must be pre-os, built-under-override, or planned');
    }

    if (!isRealDate(f.since, ctx.today)) {
      fail('since', 'since must be a real date and not in the future');
    }

    if (!f.gates || typeof f.gates !== 'object') {
      fail('gates', 'gates must be an object');
    } else {
      const { G1, G2, G3, G4 } = f.gates;
      if (G1 === undefined || G2 === undefined || G3 === undefined || G4 === undefined) {
        fail('gates', 'all four gates (G1, G2, G3, G4) must be present');
      } else {
        const g1Valid = ['not-passed', 'pass'].includes(G1) || (typeof G1 === 'string' && G1.startsWith('override:'));
        if (!g1Valid) {
          fail('G1', 'G1 must be not-passed, pass, or override:D-nnnn');
        } else if (typeof G1 === 'string' && G1.startsWith('override:')) {
          const dId = G1.split(':')[1];
          if (!ctx.decisionIds.has(dId)) {
            fail('G1', `override decision ${dId} not found in decisionIds`);
          } else if (ctx.overrideIds && !ctx.overrideIds.has(dId)) {
            fail('G1', `${dId} is not a decision with result override, so it cannot stand in for G1`);
          }
        }

        const g2Valid = G2 === 'not-required' || G2 === 'required' || (typeof G2 === 'string' && (G2.startsWith('proposed:') || G2.startsWith('approved:')));
        if (!g2Valid) {
          fail('G2', 'G2 must be not-required, required, proposed:D-nnnn, or approved:D-nnnn');
        } else if (typeof G2 === 'string' && (G2.startsWith('proposed:') || G2.startsWith('approved:'))) {
          const dId = G2.split(':')[1];
          if (!ctx.decisionIds.has(dId)) {
            fail('G2', `decision ${dId} not found in decisionIds`);
          }
        }

        if (!['not-checked', 'pass', 'fail'].includes(G3)) {
          fail('G3', 'G3 must be not-checked, pass, or fail');
        }

        const g4Valid = G4 === 'not-required' || G4 === 'required' || (typeof G4 === 'string' && (G4.startsWith('proposed:') || G4.startsWith('approved:')));
        if (!g4Valid) {
          fail('G4', 'G4 must be not-required, required, proposed:D-nnnn, or approved:D-nnnn');
        } else if (typeof G4 === 'string' && (G4.startsWith('proposed:') || G4.startsWith('approved:'))) {
          const dId = G4.split(':')[1];
          if (!ctx.decisionIds.has(dId)) {
            fail('G4', `decision ${dId} not found in decisionIds`);
          }
        }

        if (G1 === 'pass') {
          if (!Array.isArray(f.evidence) || f.evidence.length === 0) {
            fail('G1', 'G1 pass requires at least one evidence id');
          }
        }

        if (G1 === 'not-passed') {
          const canSkip = f.origin === 'pre-os' || f.status === 'idea' || f.status === 'designed';
          if (!canSkip) {
            fail('G1', 'G1 can only be not-passed if origin is pre-os, or status is idea or designed');
          }
        }

        if (f.status === 'idea') {
          if (G1 !== 'not-passed' || G2 !== 'not-required' || G3 !== 'not-checked' || G4 !== 'not-required') {
            fail('gates', 'an idea feature may only have G1 not-passed, G2 not-required, G3 not-checked, G4 not-required');
          }
        }
      }
    }

    if (f.spec !== null) {
      if (typeof f.spec !== 'string') {
        fail('spec', 'spec must be a string or null');
      } else {
        const specPath = path.resolve(ctx.root, f.spec);
        if (!fs.existsSync(specPath)) {
          fail('spec', `spec file ${f.spec} does not exist`);
        }
      }
    }

    if (!Array.isArray(f.tests)) {
      fail('tests', 'tests must be an array of paths');
    } else {
      for (const testPath of f.tests) {
        const fullPath = path.resolve(ctx.root, testPath);
        if (!fs.existsSync(fullPath)) {
          fail('tests', `test file ${testPath} does not exist`);
        }
      }
    }

    if (!Array.isArray(f.decisions)) {
      fail('decisions', 'decisions must be an array');
    } else {
      for (const dId of f.decisions) {
        if (!ctx.decisionIds.has(dId)) {
          fail('decisions', `decision ${dId} not found in decisionIds`);
        }
      }
    }

    if (!Array.isArray(f.evidence)) {
      fail('evidence', 'evidence must be an array');
    } else {
      for (const eId of f.evidence) {
        if (!ctx.evidenceIds.has(eId)) {
          fail('evidence', `evidence ${eId} not found in evidenceIds`);
        }
      }
    }
  }

  return errors;
}

export function validateFeatureLog(log, features, { today }) {
  const errors = [];
  const seenIds = new Set();
  const featureIds = new Set(features.map((f) => f.id));

  for (const event of log) {
    const id = event.id;
    const fail = (field, msg) => {
      errors.push(`${id}: ${field} - ${msg}`);
    };

    if (typeof id !== 'string' || !/^L-\d{4,}$/.test(id)) {
      errors.push(`${id || 'unknown'}: id must look like L-0001`);
      continue;
    }

    if (seenIds.has(id)) {
      fail('id', 'duplicate event id');
      continue;
    }
    seenIds.add(id);

    if (!isRealDate(event.ts, today)) {
      fail('ts', 'ts must be a real date and not in the future');
    }

    if (!featureIds.has(event.feature)) {
      fail('feature', `feature ${event.feature} not found`);
    }

    if (!EVENTS.includes(event.type)) {
      fail('type', `type must be one of ${EVENTS.join(', ')}`);
    }

    if (typeof event.actor !== 'string' || event.actor.trim() === '') {
      fail('actor', 'actor is required and must be non-empty');
    }

    if (typeof event.detail !== 'string' || event.detail.trim() === '') {
      fail('detail', 'detail is required and must be non-empty');
    }

    if (typeof event.ref !== 'string') {
      fail('ref', 'ref must be a string');
    }

    const checkText = `${event.detail || ''} ${event.ref || ''}`;
    for (const [name, pattern] of PERSONAL_PATTERNS) {
      if (pattern.test(checkText)) {
        fail('detail', `contains a ${name}`);
      }
    }
  }

  return errors;
}

export function summarize(features) {
  const total = features.length;
  const byStatus = {};
  const byArea = {};
  const awaitingFounder = [];

  for (const f of features) {
    byStatus[f.status] = (byStatus[f.status] || 0) + 1;
    byArea[f.area] = (byArea[f.area] || 0) + 1;

    const G2 = f.gates && f.gates.G2;
    const G4 = f.gates && f.gates.G4;
    const isProposedG2 = typeof G2 === 'string' && G2.startsWith('proposed:');
    const isProposedG4 = typeof G4 === 'string' && G4.startsWith('proposed:');
    if (isProposedG2 || isProposedG4) {
      awaitingFounder.push(f);
    }
  }

  return {
    total,
    byStatus,
    byArea,
    awaitingFounder,
  };
}

export function exportDashboard(features, log) {
  const sortedLog = [...log].sort((a, b) => {
    if (a.ts !== b.ts) {
      return a.ts.localeCompare(b.ts);
    }
    return a.id.localeCompare(b.id);
  });

  const featuresWithLastEvent = features.map((f) => {
    const featureEvents = log.filter((e) => e.feature === f.id);
    let lastEvent = null;
    if (featureEvents.length > 0) {
      featureEvents.sort((a, b) => {
        if (a.ts !== b.ts) {
          return b.ts.localeCompare(a.ts);
        }
        return b.id.localeCompare(a.id);
      });
      lastEvent = featureEvents[0];
    }
    return {
      ...f,
      lastEvent,
    };
  });

  return {
    schema: 1,
    summary: summarize(features),
    features: featuresWithLastEvent,
    log: sortedLog,
  };
}

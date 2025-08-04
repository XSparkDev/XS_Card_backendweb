// Calculate polling reduction with new intervals
console.log('📊 Calculating polling reduction with new intervals...\n');

// Original 30-second polling
const originalInterval = 30; // seconds
const originalRequestsPerHour = 3600 / originalInterval; // 120 requests/hour

console.log('🔴 ORIGINAL (30-second polling):');
console.log(`   Interval: ${originalInterval} seconds`);
console.log(`   Requests per hour: ${originalRequestsPerHour}`);
console.log(`   Requests per day: ${originalRequestsPerHour * 24}`);
console.log(`   Requests per month: ${originalRequestsPerHour * 24 * 30}\n`);

// New intervals
const newIntervals = {
  critical: 60,        // 1 minute
  high: 3600,         // 1 hour
  medium: 43200,      // 12 hours
  low: 86400          // 24 hours
};

console.log('🟢 NEW INTERVALS:');
Object.entries(newIntervals).forEach(([severity, seconds]) => {
  const requestsPerHour = 3600 / seconds;
  const requestsPerDay = requestsPerHour * 24;
  const requestsPerMonth = requestsPerDay * 30;
  
  console.log(`   ${severity.toUpperCase()}:`);
  console.log(`     Interval: ${seconds} seconds (${seconds/60} minutes)`);
  console.log(`     Requests per hour: ${requestsPerHour.toFixed(2)}`);
  console.log(`     Requests per day: ${requestsPerDay.toFixed(2)}`);
  console.log(`     Requests per month: ${requestsPerMonth.toFixed(2)}`);
});

// Calculate average reduction
const averageInterval = (newIntervals.critical + newIntervals.high + newIntervals.medium + newIntervals.low) / 4;
const averageRequestsPerHour = 3600 / averageInterval;
const reductionPercentage = ((originalRequestsPerHour - averageRequestsPerHour) / originalRequestsPerHour) * 100;

console.log('\n📈 REDUCTION CALCULATION:');
console.log(`   Average new interval: ${averageInterval} seconds (${(averageInterval/60).toFixed(2)} minutes)`);
console.log(`   Average requests per hour: ${averageRequestsPerHour.toFixed(2)}`);
console.log(`   Reduction: ${reductionPercentage.toFixed(2)}%`);

// Calculate by severity
console.log('\n🎯 REDUCTION BY SEVERITY:');
Object.entries(newIntervals).forEach(([severity, seconds]) => {
  const requestsPerHour = 3600 / seconds;
  const reduction = ((originalRequestsPerHour - requestsPerHour) / originalRequestsPerHour) * 100;
  console.log(`   ${severity.toUpperCase()}: ${reduction.toFixed(2)}% reduction`);
});

// Realistic scenario with alert distribution
console.log('\n📊 REALISTIC SCENARIO (Typical alert distribution):');
const alertDistribution = {
  critical: 0.05,  // 5% of alerts
  high: 0.15,      // 15% of alerts
  medium: 0.40,    // 40% of alerts
  low: 0.40        // 40% of alerts
};

let weightedRequestsPerHour = 0;
Object.entries(newIntervals).forEach(([severity, seconds]) => {
  const requestsPerHour = 3600 / seconds;
  const weight = alertDistribution[severity];
  weightedRequestsPerHour += requestsPerHour * weight;
});

const realisticReduction = ((originalRequestsPerHour - weightedRequestsPerHour) / originalRequestsPerHour) * 100;

console.log(`   Weighted average requests per hour: ${weightedRequestsPerHour.toFixed(2)}`);
console.log(`   Realistic reduction: ${realisticReduction.toFixed(2)}%`);

console.log('\n✅ SUMMARY:');
console.log(`   Original: ${originalRequestsPerHour} requests/hour`);
console.log(`   New (average): ${averageRequestsPerHour.toFixed(2)} requests/hour`);
console.log(`   New (realistic): ${weightedRequestsPerHour.toFixed(2)} requests/hour`);
console.log(`   Reduction (average): ${reductionPercentage.toFixed(2)}%`);
console.log(`   Reduction (realistic): ${realisticReduction.toFixed(2)}%`); 
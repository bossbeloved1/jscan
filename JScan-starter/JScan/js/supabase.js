
/* =====================================
   JSCAN SUPABASE CONFIGURATION
===================================== */

const JSCAN_SUPABASE_URL =
    'https://kxrdrhbfvdbietvtnxbc.supabase.co';

const JSCAN_SUPABASE_ANON_KEY =
    'sb_publishable_5RDCBtbyum6wdcvR2mQe5g_sbREnXDz';

const jscanDB = window.supabase.createClient(
    JSCAN_SUPABASE_URL,
    JSCAN_SUPABASE_ANON_KEY
);

window.jscanDB = jscanDB;

console.log('JScan Supabase initialized successfully.');

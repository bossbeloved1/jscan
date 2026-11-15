
/* =====================================
   JSCAN SUPABASE CONFIGURATION
===================================== */

(() => {
    'use strict';

    // Production Supabase project
    const JSCAN_SUPABASE_URL =
        'https://kxrdrhbfvdbietvtnxbc.supabase.co';

    // Supabase publishable key
    const JSCAN_SUPABASE_ANON_KEY =
        'sb_publishable_5RDCBtbyum6wdcvR2mQe5g_sbREnXDz';

    // Check Supabase library
    if (!window.supabase || !window.supabase.createClient) {
        console.error(
            'JScan: Supabase library failed to load.'
        );
        return;
    }

    // Prevent duplicate initialization
    if (window.jscanDB) {
        console.warn(
            'JScan: Supabase is already initialized.'
        );
        return;
    }

    // Initialize Supabase
    const jscanDB = window.supabase.createClient(
        JSCAN_SUPABASE_URL,
        JSCAN_SUPABASE_ANON_KEY
    );

    // Make client available across JScan scripts
    window.jscanDB = jscanDB;

    console.log(
        'JScan Supabase initialized successfully.'
    );
})();

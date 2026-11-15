import type {CapacitorConfig} from '@capacitor/cli';

/** Reserved, provisional identifier. No real-data installation or distribution. */
const config:CapacitorConfig={
 loggingBehavior:'none',appId:'invalid.finanzas.prototype',appName:'FinanZas Pro Prototipo',webDir:'dist',
 server:{hostname:'localhost',androidScheme:'https',iosScheme:'capacitor',cleartext:false,allowNavigation:[]},
 android:{allowMixedContent:false,webContentsDebuggingEnabled:false},
 ios:{allowsLinkPreview:false,scrollEnabled:true},
 plugins:{CapacitorHttp:{enabled:false},CapacitorCookies:{enabled:false},SystemBars:{insetsHandling:'native',initialViewportFitValueHint:'cover'},Keyboard:{resize:'native',resizeOnFullScreen:true}},
};
export default config;

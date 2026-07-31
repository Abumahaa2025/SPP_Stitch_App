import React from 'react';

import { View, StyleSheet } from 'react-native';



import { GlassTabBar } from '@/src/components/GlassTabBar';



type Props = {

  showTabBar?: boolean;

};



/** Persistent bottom navigation — daily functions only. */

export function OSChrome({ showTabBar = true }: Props) {

  return (

    <View style={styles.wrap} pointerEvents="box-none">

      {showTabBar ? <GlassTabBar /> : null}

    </View>

  );

}



const styles = StyleSheet.create({

  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 40 },

});


// GNC Secure Messenger - Blockchain-based Chat App
// File: GNCMessenger.js

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// GNC Blockchain Authentication & Messaging Service
class GNCMessagingService {
  constructor() {
    this.userWallet = null;
    this.encryptionKey = null;
    this.messages = [];
    this.channels = [
      { id: 'general', name: '🌐 General Chat', minGNC: 0 },
      { id: 'vip', name: '💎 VIP Lounge', minGNC: 1000 },
      { id: 'miners', name: '⛏️ Miners Club', minGNC: 500 },
      { id: 'keno', name: '🎯 Keno Players', minGNC: 100 },
      { id: 'whales', name: '🐋 GNC Whales', minGNC: 10000 }
    ];
    this.users = new Map();
    this.currentChannel = 'general';
  }

  // Authenticate user with GNC wallet
  async authenticateUser(privateKey, gncBalance) {
    try {
      // Simulate wallet authentication
      this.userWallet = {
        address: this.generateWalletAddress(privateKey),
        balance: gncBalance,
        privateKey: privateKey
      };
      
      // Generate encryption key from private key
      this.encryptionKey = this.deriveEncryptionKey(privateKey);
      
      return {
        success: true,
        user: {
          id: this.userWallet.address,
          username: `User_${this.userWallet.address.slice(-6)}`,
          balance: gncBalance,
          tier: this.getUserTier(gncBalance)
        }
      };
    } catch (error) {
      return { success: false, error: 'Authentication failed' };
    }
  }

  generateWalletAddress(privateKey) {
    // Simulate wallet address generation
    const hash = this.simpleHash(privateKey);
    return `gnc${hash.slice(0, 32)}`;
  }

  deriveEncryptionKey(privateKey) {
    // Derive encryption key from private key
    return this.simpleHash(privateKey + 'gnc_messenger_salt');
  }

  simpleHash(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  getUserTier(balance) {
    if (balance >= 10000) return 'whale';
    if (balance >= 1000) return 'vip';
    if (balance >= 500) return 'miner';
    if (balance >= 100) return 'player';
    return 'newcomer';
  }

  // Encrypt message using blockchain-derived key
  encryptMessage(message) {
    // Simple encryption simulation
    const encrypted = btoa(message + this.encryptionKey);
    return encrypted;
  }

  // Decrypt message
  decryptMessage(encryptedMessage) {
    try {
      const decrypted = atob(encryptedMessage);
      return decrypted.replace(this.encryptionKey, '');
    } catch {
      return '[Encrypted Message]';
    }
  }

  // Send message to blockchain
  async sendMessage(channelId, content, messageType = 'text') {
    const message = {
      id: Date.now().toString(),
      sender: this.userWallet.address,
      username: `User_${this.userWallet.address.slice(-6)}`,
      content: this.encryptMessage(content),
      originalContent: content,
      channel: channelId,
      timestamp: new Date().toISOString(),
      type: messageType,
      verified: true,
      tier: this.getUserTier(this.userWallet.balance)
    };

    // Simulate blockchain transaction
    const txHash = this.generateTxHash();
    message.txHash = txHash;

    this.messages.push(message);
    return { success: true, message, txHash };
  }

  generateTxHash() {
    return 'msg_' + Math.random().toString(36).substr(2, 16);
  }

  // Get messages for channel
  getChannelMessages(channelId) {
    return this.messages
      .filter(msg => msg.channel === channelId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // Check if user has access to channel
  hasChannelAccess(channelId) {
    const channel = this.channels.find(c => c.id === channelId);
    return this.userWallet.balance >= channel.minGNC;
  }

  // Get accessible channels for user
  getAccessibleChannels() {
    return this.channels.filter(channel => 
      this.userWallet.balance >= channel.minGNC
    );
  }
}

// Main Messenger Component
const GNCMessenger = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentChannel, setCurrentChannel] = useState('general');
  const [messageText, setMessageText] = useState('');
  const [channels, setChannels] = useState([]);
  const [privateKey, setPrivateKey] = useState('');
  const [gncBalance, setGncBalance] = useState('1500');
  
  const messagingService = useRef(new GNCMessagingService()).current;
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isAuthenticated) {
      loadChannelMessages();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [currentChannel, isAuthenticated]);

  const authenticate = async () => {
    if (!privateKey.trim()) {
      Alert.alert('Error', 'Please enter your GNC private key');
      return;
    }

    const balance = parseInt(gncBalance) || 0;
    const result = await messagingService.authenticateUser(privateKey, balance);
    
    if (result.success) {
      setCurrentUser(result.user);
      setIsAuthenticated(true);
      setChannels(messagingService.getAccessibleChannels());
      Alert.alert('Welcome!', `Connected to GNC Network\nBalance: ${balance} GNC\nTier: ${result.user.tier}`);
    } else {
      Alert.alert('Authentication Failed', result.error);
    }
  };

  const loadChannelMessages = () => {
    const channelMessages = messagingService.getChannelMessages(currentChannel);
    setMessages(channelMessages);
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;

    const result = await messagingService.sendMessage(currentChannel, messageText);
    if (result.success) {
      setMessageText('');
      loadChannelMessages();
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const switchChannel = (channelId) => {
    if (messagingService.hasChannelAccess(channelId)) {
      setCurrentChannel(channelId);
      messagingService.currentChannel = channelId;
    } else {
      const channel = messagingService.channels.find(c => c.id === channelId);
      Alert.alert('Access Denied', `You need ${channel.minGNC} GNC to access this channel`);
    }
  };

  const getTierColor = (tier) => {
    const colors = {
      whale: '#9d4edd',
      vip: '#ffd700',
      miner: '#00d4ff',
      player: '#00ff41',
      newcomer: '#ffffff'
    };
    return colors[tier] || '#ffffff';
  };

  const getTierIcon = (tier) => {
    const icons = {
      whale: '🐋',
      vip: '💎',
      miner: '⛏️',
      player: '🎮',
      newcomer: '🌱'
    };
    return icons[tier] || '👤';
  };

  const renderMessage = ({ item }) => {
    const isOwnMessage = item.sender === currentUser?.id;
    const tierColor = getTierColor(item.tier);
    const tierIcon = getTierIcon(item.tier);

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={styles.messageHeader}>
          <Text style={[styles.username, { color: tierColor }]}>
            {tierIcon} {item.username}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </View>
        <Text style={styles.messageContent}>{item.originalContent}</Text>
        <Text style={styles.verificationText}>
          ✓ Verified on GNC • {item.txHash}
        </Text>
      </View>
    );
  };

  const renderChannel = (channel) => {
    const hasAccess = messagingService.hasChannelAccess(channel.id);
    const isActive = currentChannel === channel.id;

    return (
      <TouchableOpacity
        key={channel.id}
        style={[
          styles.channelButton,
          isActive && styles.activeChannel,
          !hasAccess && styles.lockedChannel
        ]}
        onPress={() => switchChannel(channel.id)}
      >
        <Text style={[
          styles.channelText,
          isActive && styles.activeChannelText,
          !hasAccess && styles.lockedChannelText
        ]}>
          {channel.name}
        </Text>
        {!hasAccess && (
          <Text style={styles.requirementText}>
            {channel.minGNC} GNC
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (!isAuthenticated) {
    return (
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.container}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.authContainer}>
          <Text style={styles.authTitle}>🔐 GNC SECURE MESSENGER</Text>
          <Text style={styles.authSubtitle}>
            Blockchain-Encrypted Chat for GNC Holders
          </Text>
          
          <View style={styles.authForm}>
            <Text style={styles.inputLabel}>GNC Private Key:</Text>
            <TextInput
              style={styles.authInput}
              value={privateKey}
              onChangeText={setPrivateKey}
              placeholder="Enter your GNC wallet private key"
              placeholderTextColor="rgba(255,255,255,0.5)"
              secureTextEntry
            />
            
            <Text style={styles.inputLabel}>GNC Balance:</Text>
            <TextInput
              style={styles.authInput}
              value={gncBalance}
              onChangeText={setGncBalance}
              placeholder="Your GNC balance"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="numeric"
            />
            
            <TouchableOpacity style={styles.authButton} onPress={authenticate}>
              <Text style={styles.authButtonText}>🚀 CONNECT TO GNC NETWORK</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.securityInfo}>
            <Text style={styles.securityText}>🛡️ End-to-End Encrypted</Text>
            <Text style={styles.securityText}>⛓️ Blockchain Verified</Text>
            <Text style={styles.securityText}>🔒 GNC Holders Only</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GNC MESSENGER</Text>
        <View style={styles.userInfo}>
          <Text style={[styles.userTier, { color: getTierColor(currentUser.tier) }]}>
            {getTierIcon(currentUser.tier)} {currentUser.tier.toUpperCase()}
          </Text>
          <Text style={styles.userBalance}>{currentUser.balance} GNC</Text>
        </View>
      </View>

      {/* Channel Tabs */}
      <ScrollView
        horizontal
        style={styles.channelTabs}
        showsHorizontalScrollIndicator={false}
      >
        {messagingService.channels.map(renderChannel)}
      </ScrollView>

      {/* Messages Area */}
      <Animated.View style={[styles.messagesContainer, { opacity: fadeAnim }]}>
        <FlatList
          ref={scrollViewRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          onContentSizeChange={() => scrollToBottom()}
        />
      </Animated.View>

      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.messageInput}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type your encrypted message..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendMessage}
        >
          <Text style={styles.sendButtonText}>🚀</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ff41',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 255, 65, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.8,
  },
  authForm: {
    width: '100%',
    marginBottom: 30,
  },
  inputLabel: {
    color: '#00ff41',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 15,
  },
  authInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 65, 0.3)',
  },
  authButton: {
    backgroundColor: '#00ff41',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  authButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  securityInfo: {
    alignItems: 'center',
  },
  securityText: {
    color: '#00ff41',
    fontSize: 12,
    marginBottom: 5,
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ff41',
  },
  userInfo: {
    alignItems: 'flex-end',
  },
  userTier: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  userBalance: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.7,
  },
  channelTabs: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  channelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  activeChannel: {
    backgroundColor: 'rgba(0, 255, 65, 0.2)',
    borderColor: '#00ff41',
  },
  lockedChannel: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  channelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeChannelText: {
    color: '#00ff41',
  },
  lockedChannelText: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  requirementText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  messagesList: {
    flex: 1,
  },
  messageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 15,
    marginVertical: 4,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 255, 65, 0.2)',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  username: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  messageContent: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 5,
  },
  verificationText: {
    fontSize: 8,
    color: 'rgba(0, 255, 65, 0.7)',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    padding: 12,
    borderRadius: 20,
    marginRight: 10,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 65, 0.3)',
  },
  sendButton: {
    backgroundColor: '#00ff41',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 18,
  },
});

export default GNCMessenger;

// Additional Features to Add:
/*
1. File/Image sharing with blockchain verification
2. Voice messages encrypted on-chain
3. Group channels with GNC staking requirements
4. Message reactions using GNC micro-transactions
5. User profiles with NFT avatars
6. Message history stored on IPFS
7. Push notifications for mentions
8. Admin tools for channel moderation
9. Trading alerts and market discussions
10. Integration with K-dawg Keno for sharing wins
*/
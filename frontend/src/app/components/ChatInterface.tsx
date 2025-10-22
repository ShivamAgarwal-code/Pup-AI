'use client';

import { useState, useEffect, useRef } from 'react';
import { IoSendSharp } from 'react-icons/io5';
import { FaDog, FaUser } from 'react-icons/fa';
import Image from 'next/image';
import { io, Socket } from 'socket.io-client';

interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  fullPage?: boolean;
  agentId?: string; // Allow specifying which agent to connect to
}

export default function ChatInterface({ fullPage = false, agentId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Generate a consistent UUID for this client session (like Eliza's official client)
  const clientUserId = useRef(() => {
    // Use the same UUID generation method as Eliza's official client
    return URL.createObjectURL(new Blob()).split('/').pop() as string;
  });
  
  // Get the actual UUID value
  const clientId = clientUserId.current();
  
  // Use provided agentId or default to a known agent ID
  const targetAgentId = agentId || '845672b9-f3f1-0f59-971b-b281f0419423'; // Default TrendPup agent ID
  
  // Generate a DM channel ID for this user-agent pair (can be updated by server)
  const [channelId, setChannelId] = useState(() => {
    return URL.createObjectURL(new Blob()).split('/').pop() as string;
  });

  // Track messages we sent to avoid showing echoes
  const [sentMessageTexts, setSentMessageTexts] = useState<Set<string>>(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use relative path for socket.io so nginx can proxy to backend
      const socketPath = '/socket.io';
      console.log('Initializing socket connection to relative /socket.io/ path');
      
      // Reset sent messages tracking for new connection
      setSentMessageTexts(new Set());
      
      // Connect using relative path (works with nginx proxy)
      const socketConnection = io({
        path: socketPath,
        autoConnect: true,
        reconnection: true,
      });

      socketConnection.on('connect', () => {
        setIsConnected(true);
        console.log('✅ Connected to Eliza agent successfully!');
        console.log('✅ Socket ID:', socketConnection.id);
        console.log('Target Agent:', targetAgentId);
        console.log('Generated Channel ID:', channelId);
        console.log('Client ID:', clientId);
        
        // Join the DM channel with the specific agent exactly like the official client
        const joinMessage = {
          type: 1, // SOCKET_MESSAGE_TYPE.ROOM_JOINING
          payload: {
            channelId: channelId,
            roomId: channelId, // For backward compatibility
            entityId: clientId // Use proper UUID
          }
        };
        
        console.log('🚀 Sending join message:', joinMessage);
        socketConnection.emit('message', joinMessage);
        
        console.log('✅ Joined DM channel for agent:', targetAgentId);
        
        // Add a welcome message to show connection is working
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: `Connected to TrendPup! Ready to help you spot the latest trends and memecoins. What would you like to know?`,
          timestamp: new Date()
        }]);
      });

      socketConnection.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: `Connection failed: ${error.message}. Make sure Eliza is running on port 3001.`,
          timestamp: new Date()
        }]);
      });

      socketConnection.on('disconnect', (reason) => {
        setIsConnected(false);
        console.log('❌ Disconnected from server. Reason:', reason);
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: 'Connection lost. Please refresh the page to reconnect.',
          timestamp: new Date()
        }]);
      });

      socketConnection.on('reconnect', (attemptNumber) => {
        console.log('✅ Reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
      });

      socketConnection.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Reconnection attempt', attemptNumber);
      });

      socketConnection.on('reconnect_error', (error) => {
        console.error('❌ Reconnection failed:', error);
      });

      socketConnection.on('reconnect_failed', () => {
        console.error('❌ Failed to reconnect after all attempts');
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: 'Failed to reconnect to the server. Please refresh the page.',
          timestamp: new Date()
        }]);
      });

      // Listen for room join confirmation and update our channel ID
      socketConnection.on('channel_joined', (payload: any) => {
        console.log('✅ Channel joined response:', payload);
        if (payload.channelId && payload.channelId !== channelId) {
          console.log(`🔄 Updating channel ID from ${channelId} to ${payload.channelId}`);
          setChannelId(payload.channelId);
        }
      });

      // Also listen for the backward compatibility event
      socketConnection.on('room_joined', (payload: any) => {
        console.log('✅ Room joined response:', payload);
        if (payload.channelId && payload.channelId !== channelId) {
          console.log(`🔄 Updating channel ID from ${channelId} to ${payload.channelId}`);
          setChannelId(payload.channelId);
        }
      });

      // Listen for incoming messages like the official client
      socketConnection.on('messageBroadcast', (data) => {
        console.log('📨 Received messageBroadcast:', data);
        
        // Check if it's for our channel
        const msgChannelId = data.channelId || data.roomId;
        const isForOurChannel = msgChannelId === channelId;
        
        console.log('📋 Message channel:', msgChannelId, 'Our channel:', channelId);
        console.log('🔍 Is for our channel?', isForOurChannel);
        
        // Only accept messages for our current channel
        if (!isForOurChannel) {
          console.log('❌ Message not for our channel, ignoring');
          return;
        }
        
        // Check if this is an echo of our own message or an actual agent response
        const messageText = data.text || data.message || '';
        const senderId = data.senderId || data.userId;
        const isFromTargetAgent = senderId === targetAgentId;
        const isOurOwnEcho = sentMessageTexts.has(messageText);
        
        console.log('👤 Message text:', messageText);
        console.log('� Sender ID:', senderId);
        console.log('🤖 Target agent ID:', targetAgentId);
        console.log('�🔍 Is from target agent?', isFromTargetAgent);
        console.log('🔍 Is our own echo?', isOurOwnEcho);
        console.log('📋 Sent messages:', Array.from(sentMessageTexts));
        
        // Only show messages that are from the target agent and not our own echoes
        if (!isFromTargetAgent || isOurOwnEcho) {
          console.log('❌ Ignoring message - not from agent or is echo');
          return;
        }
        
        console.log('✅ Message for our channel - accepting it!');
        
        // Extract message content more flexibly
        const messageContent = data.text || data.message || data.content || (data.rawMessage && data.rawMessage.text) || JSON.stringify(data);
        
        console.log('💬 Adding agent message to chat:', messageContent);
        
        setIsTyping(false);
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: messageContent,
          timestamp: new Date(data.createdAt || Date.now())
        }]);
      });

      socketConnection.on('messageComplete', (data) => {
        console.log('📋 Received messageComplete:', data);
        setIsTyping(false);
      });

      // Add debug listeners for all socket events
      socketConnection.onAny((eventName, ...args) => {
        if (eventName !== 'messageBroadcast') { // We already log this one
          console.log(`🔍 Socket event '${eventName}':`, args);
        }
      });

      socketConnection.on('error', (error) => {
        console.error('Socket error:', error);
        setIsTyping(false);
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: `Error: ${error.message || 'Connection error'}`,
          timestamp: new Date()
        }]);
      });

      setSocket(socketConnection);

      return () => {
        socketConnection.disconnect();
      };
    }
  }, [targetAgentId]); // Re-connect when agent changes

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    if (!socket || !input.trim() || !isConnected) return;

    const messageText = input.trim();

    // Track this message to avoid showing echoes
    setSentMessageTexts(prev => {
      const newSet = new Set([...prev, messageText]);
      // Keep only the last 10 messages to prevent memory issues
      if (newSet.size > 10) {
        const array = Array.from(newSet);
        return new Set(array.slice(-10));
      }
      return newSet;
    });

    // Add user message to chat
    setMessages(prev => [...prev, {
      type: 'user',
      content: messageText,
      timestamp: new Date()
    }]);

    // Show typing indicator
    setIsTyping(true);

    const messagePayload = {
      type: 2, // SOCKET_MESSAGE_TYPE.SEND_MESSAGE
      payload: {
        senderId: clientId, // Use proper UUID
        senderName: 'User',
        message: messageText,
        channelId: channelId,
        roomId: channelId, // For backward compatibility
        serverId: '00000000-0000-0000-0000-000000000000',
        messageId: URL.createObjectURL(new Blob()).split('/').pop() as string,
        source: 'trendpup-frontend',
        metadata: {
          isDm: true,
          channelType: 'DM',
          targetUserId: targetAgentId // Tell the backend this is a DM with the agent
        }
      }
    };

    console.log('📤 Sending message to agent:', targetAgentId);
    console.log('📋 Message payload:', messagePayload);

    // Send message exactly like the official Eliza client for DM
    socket.emit('message', messagePayload);

    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const containerHeight = fullPage ? 'h-[calc(100vh-8rem)]' : 'h-[calc(100vh-12rem)]';

  return (
    <div className={`flex flex-col ${containerHeight} max-w-4xl mx-auto rounded-xl shadow-xl overflow-hidden border border-trendpup-brown/20 bg-white`}>
      {!fullPage && (
        <div className="bg-trendpup-dark text-white p-4 flex items-center">
          <div className="flex-shrink-0 mr-3">
            <Image 
              src="/trendpup-logo.png" 
              alt="TrendPup Logo" 
              width={32} 
              height={32}
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold">TrendPup Assistant</h1>
            <p className="text-sm opacity-75">
              {isConnected ? `Connected to ${targetAgentId ? 'Agent ' + targetAgentId.slice(0, 8) + '...' : 'TrendPup'} - Ready to chat` : 'Connecting...'}
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-trendpup-light">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start max-w-[80%] ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  msg.type === 'user' ? 'bg-trendpup-orange ml-2' : 'bg-trendpup-brown mr-2'
                }`}>
                  {msg.type === 'user' ? (
                    <FaUser className="text-white text-sm" />
                  ) : (
                    <FaDog className="text-white text-sm" />
                  )}
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    msg.type === 'user'
                      ? 'bg-trendpup-orange text-white'
                      : 'bg-white text-trendpup-dark border border-trendpup-brown/20'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-xs opacity-75 mt-1 block">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-trendpup-brown mr-2 flex items-center justify-center">
                  <FaDog className="text-white text-sm" />
                </div>
                <div className="bg-white text-gray-800 rounded-lg p-3 border border-trendpup-brown/20">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-trendpup-brown rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-trendpup-brown rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-trendpup-brown rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-trendpup-brown/10">
        <div className="flex items-end space-x-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Ask about memecoins, trends, or market insights..." : "Connecting..."}
            disabled={!isConnected}
            className="flex-1 p-3 border border-trendpup-brown/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-trendpup-orange resize-none h-12 max-h-32 min-h-[3rem]"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !input.trim()}
            className="p-3 bg-trendpup-orange text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <IoSendSharp className="text-xl" />
          </button>
        </div>
      </div>
    </div>
  );
}
'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Star, Users, BarChart3, Shield, Zap, Globe, Smartphone, Database, TrendingUp, Clock, HeadphonesIcon, Sparkles, Rocket, Brain, Cpu, Network, Layers, Play, ArrowRight } from 'lucide-react';
import './landing.css';

export default function LandingPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState<{ [key: string]: boolean }>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setIsLoaded(true);
    
    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    // Scroll tracking
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    // Intersection Observer for scroll animations
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(prev => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    // Observe elements for scroll animations
    const elements = document.querySelectorAll('[data-animate]');
    elements.forEach((el) => {
      if (observerRef.current) {
        observerRef.current.observe(el);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden gpu-accelerated">
      {/* Enhanced Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Orbs with Parallax */}
        <div 
          className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse will-change-transform"
          style={{ transform: `translateY(${scrollY * 0.1}px)` }}
        ></div>
        <div 
          className="absolute top-40 right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000 will-change-transform"
          style={{ transform: `translateY(${scrollY * -0.05}px)` }}
        ></div>
        <div 
          className="absolute bottom-20 left-1/3 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-2000 will-change-transform"
          style={{ transform: `translateY(${scrollY * 0.08}px)` }}
        ></div>
        
        {/* Animated Grid Pattern */}
        <div 
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:50px_50px] will-change-transform"
          style={{ 
            transform: `translate(${scrollY * 0.02}px, ${scrollY * 0.01}px)`,
            animation: 'pulse 4s ease-in-out infinite'
          }}
        ></div>
        
        {/* Enhanced Mouse Follower */}
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-purple-400/10 to-blue-400/10 rounded-full blur-3xl pointer-events-none transition-all duration-300 ease-out will-change-transform"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
            opacity: Math.min(scrollY / 1000, 0.3)
          }}
        ></div>
      </div>

      {/* Enhanced Navigation */}
      <nav className="fixed top-0 w-full bg-black/20 backdrop-blur-xl border-b border-white/10 z-50 transition-all duration-300 will-change-transform">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-2 group">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform duration-300 will-change-transform">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-bold text-white group-hover:text-purple-300 transition-colors duration-300">InventryPro</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
              <Link href="#features" className="text-gray-300 hover:text-purple-300 transition-all duration-300 hover:scale-105 relative group">
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-300 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="#pricing" className="text-gray-300 hover:text-purple-300 transition-all duration-300 hover:scale-105 relative group">
                Pricing
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-300 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="#about" className="text-gray-300 hover:text-purple-300 transition-all duration-300 hover:scale-105 relative group">
                About
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-300 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="#testimonials" className="text-gray-300 hover:text-purple-300 transition-all duration-300 hover:scale-105 relative group">
                Reviews
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-300 group-hover:w-full transition-all duration-300"></span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-purple-300 transition-all duration-300 text-xs sm:text-sm px-2 sm:px-3">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/25 text-xs sm:text-sm px-2 sm:px-3 will-change-transform">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Enhanced Hero Section */}
      <section className="pt-20 sm:pt-24 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <Badge className={`mb-4 sm:mb-6 bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 border-purple-500/30 backdrop-blur-sm transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} text-xs sm:text-sm`}>
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
              Now Supporting Multi-Shop Management
            </Badge>
            
            <h1 className={`text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 sm:mb-6 transition-all duration-1000 delay-200 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} leading-tight`}>
              Transform Your Business with
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-pulse block sm:inline">
                {' '}Smart Inventory
              </span>
            </h1>
            
            <p className={`text-lg sm:text-xl text-gray-300 mb-6 sm:mb-8 max-w-3xl mx-auto transition-all duration-1000 delay-400 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} px-4`}>
              The most powerful, user-friendly inventory management system for modern businesses. 
              Track, manage, and optimize your inventory across multiple locations with ease.
            </p>
            
            <div className={`flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 sm:mb-12 transition-all duration-1000 delay-600 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} px-4`}>
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/25 group w-full sm:w-auto">
                  <Rocket className="ml-2 w-4 h-4 sm:w-5 sm:h-5 group-hover:animate-bounce" />
                  Start Free Trial
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-white border-white/30 hover:bg-white hover:text-purple-600 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 hover:scale-105 transition-all duration-300 backdrop-blur-sm bg-white/10 w-full sm:w-auto group">
                <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                Watch Demo
              </Button>
            </div>
            
            <div className={`flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-8 text-xs sm:text-sm text-gray-400 transition-all duration-1000 delay-800 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} px-4`}>
              <div className="flex items-center group">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 mr-2 group-hover:scale-110 transition-transform duration-300" />
                No credit card required
              </div>
              <div className="flex items-center group">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 mr-2 group-hover:scale-110 transition-transform duration-300" />
                14-day free trial
              </div>
              <div className="flex items-center group">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 mr-2 group-hover:scale-110 transition-transform duration-300" />
                Cancel anytime
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Stats Section */}
      <section className="py-8 sm:py-12 bg-black/20 backdrop-blur-sm" data-animate="stats">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
            <div className={`group transition-all duration-1000 ${isVisible.stats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{transitionDelay: '0ms'}}>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-1 sm:mb-2 group-hover:scale-110 transition-transform duration-300">10,000+</div>
              <div className="text-gray-300 text-xs sm:text-sm group-hover:text-purple-300 transition-colors duration-300">Active Users</div>
            </div>
            <div className={`group transition-all duration-1000 ${isVisible.stats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{transitionDelay: '100ms'}}>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-1 sm:mb-2 group-hover:scale-110 transition-transform duration-300">50M+</div>
              <div className="text-gray-300 text-xs sm:text-sm group-hover:text-blue-300 transition-colors duration-300">Products Tracked</div>
            </div>
            <div className={`group transition-all duration-1000 ${isVisible.stats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{transitionDelay: '200ms'}}>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent mb-1 sm:mb-2 group-hover:scale-110 transition-transform duration-300">99.9%</div>
              <div className="text-gray-300 text-xs sm:text-sm group-hover:text-cyan-300 transition-colors duration-300">Uptime</div>
            </div>
            <div className={`group transition-all duration-1000 ${isVisible.stats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{transitionDelay: '300ms'}}>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-purple-400 bg-clip-text text-transparent mb-1 sm:mb-2 group-hover:scale-110 transition-transform duration-300">24/7</div>
              <div className="text-gray-300 text-xs sm:text-sm group-hover:text-green-300 transition-colors duration-300">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Features Section */}
      <section id="features" className="py-12 sm:py-16 bg-gradient-to-b from-transparent to-black/30" data-animate="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 sm:mb-4 transition-all duration-1000 ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              Everything You Need to Manage Your Inventory
            </h2>
            <p className={`text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto transition-all duration-1000 delay-200 ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              Powerful features designed to streamline your inventory management and boost your business efficiency.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <Card className={`border-0 bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{transitionDelay: '0ms'}}>
              <CardHeader className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:rotate-12 transition-transform duration-300">
                  <Database className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <CardTitle className="text-white group-hover:text-purple-300 transition-colors duration-300 text-lg sm:text-xl">Multi-Shop Management</CardTitle>
                <CardDescription className="text-gray-300 group-hover:text-gray-200 transition-colors duration-300 text-sm sm:text-base">
                  Manage inventory across multiple locations, shops, and warehouses from a single dashboard.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className={`border-0 bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{transitionDelay: '100ms'}}>
              <CardHeader className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:rotate-12 transition-transform duration-300">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <CardTitle className="text-white group-hover:text-blue-300 transition-colors duration-300 text-lg sm:text-xl">Real-Time Analytics</CardTitle>
                <CardDescription className="text-gray-300 group-hover:text-gray-200 transition-colors duration-300 text-sm sm:text-base">
                  Get instant insights into sales trends, stock levels, and business performance with live dashboards.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className={`border-0 bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{transitionDelay: '200ms'}}>
              <CardHeader className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-cyan-500 to-green-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:rotate-12 transition-transform duration-300">
                  <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <CardTitle className="text-white group-hover:text-cyan-300 transition-colors duration-300 text-lg sm:text-xl">Mobile-First Design</CardTitle>
                <CardDescription className="text-gray-300 group-hover:text-gray-200 transition-colors duration-300 text-sm sm:text-base">
                  Access your inventory anywhere with our responsive, mobile-optimized interface.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className={`border-0 bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{transitionDelay: '300ms'}}>
              <CardHeader className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-500 to-purple-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:rotate-12 transition-transform duration-300">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <CardTitle className="text-white group-hover:text-green-300 transition-colors duration-300 text-lg sm:text-xl">Customer Management</CardTitle>
                <CardDescription className="text-gray-300 group-hover:text-gray-200 transition-colors duration-300 text-sm sm:text-base">
                  Track customer purchases, manage credit accounts, and maintain detailed customer ledgers.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className={`border-0 bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{transitionDelay: '400ms'}}>
              <CardHeader className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:rotate-12 transition-transform duration-300">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <CardTitle className="text-white group-hover:text-purple-300 transition-colors duration-300 text-lg sm:text-xl">Enterprise Security</CardTitle>
                <CardDescription className="text-gray-300 group-hover:text-gray-200 transition-colors duration-300 text-sm sm:text-base">
                  Bank-level security with role-based access control and data encryption.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className={`border-0 bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/20 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{transitionDelay: '500ms'}}>
              <CardHeader className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-pink-500 to-blue-500 rounded-lg flex items-center justify-center mb-3 sm:mb-4 group-hover:rotate-12 transition-transform duration-300">
                  <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <CardTitle className="text-white group-hover:text-pink-300 transition-colors duration-300 text-lg sm:text-xl">Multi-Language Support</CardTitle>
                <CardDescription className="text-gray-300 group-hover:text-gray-200 transition-colors duration-300 text-sm sm:text-base">
                  Available in multiple languages including Hindi and English for global accessibility.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 sm:py-16 bg-gradient-to-b from-black/30 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-300">
              Choose the plan that fits your business needs. Upgrade or downgrade anytime.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <Card className="border-2 border-gray-700 hover:border-purple-500 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 bg-black/20 backdrop-blur-sm group">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-white group-hover:text-purple-300 transition-colors duration-300">Starter</CardTitle>
                <CardDescription className="text-gray-300 group-hover:text-gray-200 transition-colors duration-300">Perfect for small businesses</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">₹999</span>
                  <span className="text-gray-300">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Up to 1,000 products
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    1 shop location
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Basic reporting
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Email support
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Mobile app access
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/25">
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>
            
            {/* Professional Plan */}
            <Card className="border-2 border-purple-500 relative hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/30 transition-all duration-500 bg-black/30 backdrop-blur-sm group">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0 animate-pulse">Most Popular</Badge>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-white group-hover:text-purple-300 transition-colors duration-300">Professional</CardTitle>
                <CardDescription className="text-gray-300 group-hover:text-gray-200 transition-colors duration-300">Ideal for growing businesses</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">₹2,499</span>
                  <span className="text-gray-300">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Up to 10,000 products
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Up to 5 shop locations
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Advanced analytics
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Priority support
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    API access
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Custom reports
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/25">
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>
            
            {/* Enterprise Plan */}
            <Card className="border-2 border-gray-700 hover:border-blue-500 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20 bg-black/20 backdrop-blur-sm group">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-white group-hover:text-blue-300 transition-colors duration-300">Enterprise</CardTitle>
                <CardDescription className="text-gray-300 group-hover:text-gray-200 transition-colors duration-300">For large organizations</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">₹4,999</span>
                  <span className="text-gray-300">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Unlimited products
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Unlimited locations
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    White-label solution
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    24/7 dedicated support
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Custom integrations
                  </li>
                  <li className="flex items-center text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3 group-hover:scale-110 transition-transform duration-300" />
                    Advanced security
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-blue-500/25">
                  Contact Sales
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center mt-12">
            <p className="text-gray-300 mb-4">All plans include 14-day free trial • No setup fees • Cancel anytime</p>
            <p className="text-sm text-gray-400">Need a custom plan? <Link href="#contact" className="text-purple-400 hover:text-purple-300 hover:underline transition-colors duration-300">Contact our sales team</Link></p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gradient-to-b from-transparent to-black/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Built by Entrepreneurs, for Entrepreneurs
              </h2>
              <p className="text-lg text-gray-300 mb-6">
                InventryPro was born from the frustration of managing inventory across multiple locations 
                with outdated, clunky systems. We understand the challenges of modern business operations 
                and built a solution that actually works.
              </p>
              <p className="text-lg text-gray-300 mb-8">
                Our team of experienced developers and business owners has created a platform that 
                combines powerful functionality with intuitive design. We're committed to helping 
                businesses of all sizes streamline their operations and grow faster.
              </p>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="group">
                  <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">5+</div>
                  <div className="text-gray-300 group-hover:text-purple-300 transition-colors duration-300">Years Experience</div>
                </div>
                <div className="group">
                  <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">50+</div>
                  <div className="text-gray-300 group-hover:text-blue-300 transition-colors duration-300">Team Members</div>
                </div>
                <div className="group">
                  <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">15+</div>
                  <div className="text-gray-300 group-hover:text-cyan-300 transition-colors duration-300">Countries Served</div>
                </div>
                <div className="group">
                  <div className="text-2xl font-bold bg-gradient-to-r from-green-400 to-purple-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">99%</div>
                  <div className="text-gray-300 group-hover:text-green-300 transition-colors duration-300">Customer Satisfaction</div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white hover:scale-105 transition-all duration-500 shadow-2xl shadow-purple-500/25">
                <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
                <p className="text-lg mb-6">
                  To empower businesses with intelligent inventory management tools that drive growth, 
                  reduce costs, and improve customer satisfaction.
                </p>
                <div className="flex items-center space-x-4 group">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-semibold">Customer-First Approach</div>
                    <div className="text-sm opacity-90">Your success is our success</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              What Our Customers Say
            </h2>
            <p className="text-xl text-gray-300">
              Join thousands of satisfied customers who have transformed their business operations.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 group">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current group-hover:scale-110 transition-transform duration-300" style={{animationDelay: `${i * 100}ms`}} />
                  ))}
                </div>
                <p className="text-gray-300 mb-4 group-hover:text-gray-200 transition-colors duration-300">
                  "InventryPro has revolutionized how we manage our inventory. The multi-shop feature 
                  is a game-changer for our business."
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mr-3 group-hover:rotate-12 transition-transform duration-300">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white group-hover:text-purple-300 transition-colors duration-300">Rajesh Kumar</div>
                    <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-300">CEO, Kumar Hardware</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20 group">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current group-hover:scale-110 transition-transform duration-300" style={{animationDelay: `${i * 100}ms`}} />
                  ))}
                </div>
                <p className="text-gray-300 mb-4 group-hover:text-gray-200 transition-colors duration-300">
                  "The analytics dashboard gives us insights we never had before. Our inventory 
                  turnover has improved by 40% since using InventryPro."
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mr-3 group-hover:rotate-12 transition-transform duration-300">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white group-hover:text-blue-300 transition-colors duration-300">Priya Sharma</div>
                    <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-300">Operations Manager, Sharma Electronics</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20 group">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current group-hover:scale-110 transition-transform duration-300" style={{animationDelay: `${i * 100}ms`}} />
                  ))}
                </div>
                <p className="text-gray-300 mb-4 group-hover:text-gray-200 transition-colors duration-300">
                  "Customer support is outstanding. They helped us migrate from our old system 
                  seamlessly. Highly recommended!"
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-green-500 rounded-full flex items-center justify-center mr-3 group-hover:rotate-12 transition-transform duration-300">
                    <HeadphonesIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors duration-300">Amit Patel</div>
                    <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-300">Owner, Patel Construction</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]"></div>
        
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of businesses already using InventryPro to streamline their operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-6 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-white/25 group">
                <Rocket className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                Start Your Free Trial
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-purple-600 text-lg px-8 py-6 hover:scale-105 transition-all duration-300 backdrop-blur-sm">
              Schedule Demo
            </Button>
          </div>
          <p className="text-blue-100 mt-6">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/50 backdrop-blur-sm text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4 group">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold group-hover:text-purple-300 transition-colors duration-300">InventryPro</span>
              </div>
              <p className="text-gray-400 mb-4">
                The most powerful inventory management system for modern businesses.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4 text-purple-300">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#features" className="hover:text-purple-300 transition-colors duration-300">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-purple-300 transition-colors duration-300">Pricing</Link></li>
                <li><Link href="#" className="hover:text-purple-300 transition-colors duration-300">Integrations</Link></li>
                <li><Link href="#" className="hover:text-purple-300 transition-colors duration-300">API</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4 text-blue-300">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#about" className="hover:text-blue-300 transition-colors duration-300">About</Link></li>
                <li><Link href="#" className="hover:text-blue-300 transition-colors duration-300">Blog</Link></li>
                <li><Link href="#" className="hover:text-blue-300 transition-colors duration-300">Careers</Link></li>
                <li><Link href="#" className="hover:text-blue-300 transition-colors duration-300">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4 text-cyan-300">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-cyan-300 transition-colors duration-300">Help Center</Link></li>
                <li><Link href="#" className="hover:text-cyan-300 transition-colors duration-300">Documentation</Link></li>
                <li><Link href="#" className="hover:text-cyan-300 transition-colors duration-300">Status</Link></li>
                <li><Link href="#" className="hover:text-cyan-300 transition-colors duration-300">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 InventryPro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
